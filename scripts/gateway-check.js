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

    checkSafetyHelpers();
    await checkRoutePlanning(srcRoot);
    await checkOptionalZipExtraction(srcRoot, outRoot);

    console.log("ok - gateway behavior");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

function checkSafetyHelpers() {
  const { safeSegment, sanitizeRuntimeText, isInsideOrSame } = gateway._test;
  const segment = safeSegment("../bad/name");
  assert(!segment.includes("/"), "safeSegment must remove slashes");
  assert(!segment.includes(".."), "safeSegment must remove parent traversal");
  assert.strictEqual(isInsideOrSame("/tmp/root", "/tmp/root/out"), true);
  assert.strictEqual(isInsideOrSame("/tmp/root", "/tmp/root2/out"), false);
  assert.strictEqual(sanitizeRuntimeText(`/${"Users"}/example/secret/file.txt failed`), "[local-path] failed");
  assert.strictEqual(sanitizeRuntimeText("C:\\Users\\example\\secret\\file.txt failed"), "[local-path] failed");
}

async function checkRoutePlanning(srcRoot) {
  const xp3Path = path.join(srcRoot, "data.xp3");
  await fs.writeFile(xp3Path, Buffer.from("XP3\r\n\0\0\0\0\0\0\0\0", "binary"));
  const plan = await gateway.planExtraction(srcRoot, [{ relativePath: "data.xp3", ext: "xp3", size: 12 }]);
  assert.strictEqual(plan.summary.total, 1);
  assert.strictEqual(plan.routes[0].route, "visual-novel");
  assert(["adapter-needed", "external-ready"].includes(plan.routes[0].status));
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
  assert(result.resultPath.startsWith(outRoot), "extraction result must stay inside output root");
}

main().catch((error) => {
  console.error(`fail - gateway behavior: ${error.message}`);
  process.exit(1);
});
