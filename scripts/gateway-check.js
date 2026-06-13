#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const gateway = require("../electron/extractor-gateway");

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "galassetbox-gateway-check-"));
  const srcRoot = path.join(tmpRoot, "src");
  const outRoot = path.join(tmpRoot, "out");

  try {
    await fs.mkdir(srcRoot);
    await fs.mkdir(outRoot);

    await checkSafetyHelpers(tmpRoot);
    await checkRoutePlanning(srcRoot);
    await checkRealpathInputGuard(tmpRoot);
    await checkOptionalZipExtraction(srcRoot, outRoot);

    console.log("ok - gateway behavior");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

async function checkSafetyHelpers(tmpRoot) {
  const { inspectExtractedTree, safeSegment, sanitizeRuntimeText, isInsideOrSame } = gateway._test;
  const segment = safeSegment("../bad/name");
  assert(!segment.includes("/"), "safeSegment must remove slashes");
  assert(!segment.includes(".."), "safeSegment must remove parent traversal");
  assert.strictEqual(isInsideOrSame("/tmp/root", "/tmp/root/out"), true);
  assert.strictEqual(isInsideOrSame("/tmp/root", "/tmp/root2/out"), false);
  assert.strictEqual(sanitizeRuntimeText(`/${"Users"}/example/secret/file.txt failed`), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("C:\\Users\\example\\secret\\file.txt failed"), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("/Volumes/GameDisk/WhiteAlbum/data.pak failed"), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("/private/var/folders/run/tool.log failed"), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("D:\\Games\\Title\\data.arc failed"), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("\\\\NAS\\Share\\Title\\data.zip failed"), "[local-path] failed");

  const extracted = path.join(tmpRoot, "inspect");
  await fs.mkdir(extracted);
  await fs.writeFile(path.join(extracted, "ok.txt"), "ok");
  const inspection = await inspectExtractedTree(extracted);
  assert.strictEqual(inspection.fileCount, 1);
  assert.strictEqual(inspection.byteCount, 2);

  try {
    const outside = path.join(tmpRoot, "outside.txt");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, path.join(extracted, "outside-link"));
    await assert.rejects(() => inspectExtractedTree(extracted), /符号链接|输出目录外/);
  } catch (error) {
    if (!["EPERM", "EACCES"].includes(error.code)) throw error;
  }
}

async function checkRoutePlanning(srcRoot) {
  const xp3Path = path.join(srcRoot, "data.xp3");
  await fs.writeFile(xp3Path, Buffer.from("XP3\r\n\0\0\0\0\0\0\0\0", "binary"));
  const plan = await gateway.planExtraction(srcRoot, [{ relativePath: "data.xp3", ext: "xp3", size: 12 }]);
  assert.strictEqual(plan.summary.total, 1);
  assert.strictEqual(plan.routes[0].route, "visual-novel");
  assert(["adapter-needed", "external-ready"].includes(plan.routes[0].status));

  const hcaPath = path.join(srcRoot, "voice.hca");
  await fs.writeFile(hcaPath, Buffer.from("HCA\0", "binary"));
  const audioPlan = await gateway.planExtraction(
    srcRoot,
    [{ relativePath: "voice.hca", ext: "hca", size: 4 }],
    {
      toolOverrides: {
        ffmpeg: process.execPath,
        vgmstream: path.join(srcRoot, "missing-vgmstream"),
      },
    },
  );
  assert.strictEqual(audioPlan.routes[0].route, "game-audio");
  assert.strictEqual(audioPlan.routes[0].status, "tool-missing");
  assert(audioPlan.routes[0].note.includes("vgmstream"), "game audio should require vgmstream");

  const ressPath = path.join(srcRoot, "sharedassets0.resS");
  await fs.writeFile(ressPath, "Unity resource sidecar");
  const unityPlan = await gateway.planExtraction(srcRoot, [{ relativePath: "sharedassets0.resS", ext: "ress", size: 22 }]);
  assert.strictEqual(unityPlan.routes[0].route, "unity");
}

async function checkRealpathInputGuard(tmpRoot) {
  const sourceRoot = path.join(tmpRoot, "realpath-src");
  const outputRoot = path.join(tmpRoot, "realpath-out");
  const outsidePath = path.join(tmpRoot, "outside.zip");
  await fs.mkdir(sourceRoot);
  await fs.mkdir(outputRoot);
  await fs.writeFile(outsidePath, "not a real zip");

  try {
    await fs.symlink(outsidePath, path.join(sourceRoot, "escape.zip"));
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) return;
    throw error;
  }

  await assert.rejects(() => gateway.extractCommonArchives({
    sourceRoot,
    outputRoot,
    resultRootName: "Realpath_Guard",
    records: [{ relativePath: "escape.zip", ext: "zip", size: 1 }],
    toolOverrides: { sevenZip: process.execPath },
  }), /指向源目录外/);
}

async function checkOptionalZipExtraction(srcRoot, outRoot) {
  const status = await gateway.getExtractorStatus();
  const sevenZip = status.tools.sevenZip?.command;
  if (!sevenZip) {
    console.log("skip - gateway zip extraction (7-Zip not found)");
    return;
  }

  const notePath = path.join(srcRoot, "note.txt");
  const zipPath = path.join(srcRoot, "sample.zip");
  await fs.writeFile(notePath, "hello from gateway check\n");
  await execFileAsync(sevenZip, ["a", zipPath, notePath], { timeout: 10000 });

  const result = await gateway.extractCommonArchives({
    sourceRoot: srcRoot,
    outputRoot: outRoot,
    resultRootName: "../Gateway_Check",
    records: [{ relativePath: "sample.zip", ext: "zip", size: 1 }],
    toolOverrides: { sevenZip },
  });

  assert.strictEqual(result.extracted, 1);
  assert.strictEqual(result.failed, 0);
  assert.strictEqual(result.omitted, 0);
  assert(gateway._test.isInsideOrSame(outRoot, result.resultPath), "extraction result must stay inside output root");

  const disguisedPath = path.join(srcRoot, "payload.dat");
  await fs.copyFile(zipPath, disguisedPath);
  const disguisedPlan = await gateway.planExtraction(srcRoot, [{ relativePath: "payload.dat", ext: "dat", size: 1 }]);
  assert.strictEqual(disguisedPlan.routes[0].route, "common-archive");
  const disguisedResult = await gateway.extractCommonArchives({
    sourceRoot: srcRoot,
    outputRoot: outRoot,
    resultRootName: "Disguised_Zip",
    records: [{ relativePath: "payload.dat", ext: "dat", size: 1 }],
    toolOverrides: { sevenZip },
  });
  assert.strictEqual(disguisedResult.extracted, 1);

  await assert.rejects(() => gateway.extractCommonArchives({
    sourceRoot: srcRoot,
    outputRoot: outRoot,
    resultRootName: "Unsafe_Path",
    records: [{ relativePath: "../sample.zip", ext: "zip", size: 1 }],
    toolOverrides: { sevenZip },
  }), /相对路径不安全|路径超出源目录/);
}

main().catch((error) => {
  console.error(`fail - gateway behavior: ${error.message}`);
  process.exit(1);
});
