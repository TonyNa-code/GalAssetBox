const { execFile, spawn } = require("child_process");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const COMMON_ARCHIVE_EXTS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "tbz2",
  "xz",
  "txz",
  "lzma",
  "cab",
  "iso",
  "lzh",
]);

const VN_ARCHIVE_EXTS = new Set([
  "xp3",
  "rpa",
  "rpi",
  "nsa",
  "ns2",
  "sar",
  "arc",
  "pck",
  "dat",
  "pak",
  "wolf",
  "pac",
  "cpk",
  "afs",
  "ald",
  "int",
  "gxp",
  "cpz",
  "ypf",
  "tlg",
]);

const UNITY_EXTS = new Set(["assets", "unity3d", "bundle", "ress", "resS".toLowerCase()]);
const GAME_AUDIO_EXTS = new Set(["acb", "awb", "hca", "adx", "wem", "fsb", "at3", "xma", "xa", "dsp"]);
const MEDIA_PROBE_EXTS = new Set(["movie", "mp4", "mkv", "webm", "avi", "mov", "wmv", "mpg", "mpeg"]);
const MAX_COMMON_ARCHIVE_RUN = 12;
const MAX_EXTRACTED_FILES_PER_ARCHIVE = 20000;
const MAX_EXTRACTED_BYTES_PER_ARCHIVE = 8 * 1024 * 1024 * 1024;

class PolicyViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PolicyViolationError";
    this.policyViolation = true;
  }
}

const TOOL_DEFS = [
  {
    id: "sevenZip",
    label: "7-Zip",
    commands: ["7zz", "7z", "7za"],
    roles: ["common-archive"],
    installHint: "安装 7-Zip / p7zip，用于普通压缩包解包。",
  },
  {
    id: "bsdtar",
    label: "bsdtar / libarchive",
    commands: ["bsdtar"],
    roles: ["common-archive"],
    installHint: "系统 libarchive 工具，可处理部分 zip/rar/7z/tar。",
  },
  {
    id: "unar",
    label: "unar",
    commands: ["unar"],
    roles: ["common-archive"],
    installHint: "The Unarchiver CLI，可作为普通压缩包解包补充。",
  },
  {
    id: "garbro",
    label: "GARbro Console",
    commands: ["GARbro.Console", "GARbro.Console.exe", "garbro"],
    roles: ["visual-novel"],
    installHint: "用于大量 Visual Novel 引擎封包，需要用户自行安装并确认授权。",
  },
  {
    id: "gameExtractor",
    label: "Game Extractor",
    commands: ["gameextractor", "GameExtractor", "GameExtractor.exe"],
    roles: ["visual-novel", "game-archive"],
    installHint: "用于游戏封包和图片格式的外部工具路线。",
  },
  {
    id: "assetRipper",
    label: "AssetRipper",
    commands: ["AssetRipper", "AssetRipper.exe"],
    roles: ["unity"],
    installHint: "用于 Unity assets / bundles 的外部工具路线。",
  },
  {
    id: "vgmstream",
    label: "vgmstream-cli",
    commands: ["vgmstream-cli"],
    roles: ["game-audio"],
    installHint: "用于 HCA/ADX/WEM/FSB 等游戏音频解码。",
  },
  {
    id: "ffmpeg",
    label: "ffmpeg",
    commands: ["ffmpeg"],
    roles: ["media-probe", "audio-video"],
    installHint: "用于常规音视频探测和转换。",
  },
  {
    id: "ffprobe",
    label: "ffprobe",
    commands: ["ffprobe"],
    roles: ["media-probe"],
    installHint: "用于常规音视频格式探测。",
  },
];

const TOOL_IDS = new Set(TOOL_DEFS.map((tool) => tool.id));

async function getExtractorStatus(toolOverrides = {}) {
  const tools = {};
  for (const tool of TOOL_DEFS) {
    const resolved = await findFirstExecutable(tool, toolOverrides[tool.id]);
    tools[tool.id] = {
      id: tool.id,
      label: tool.label,
      command: resolved.command || "",
      commandName: resolved.command ? path.basename(resolved.command) : "",
      available: Boolean(resolved.command),
      configured: resolved.configured,
      source: resolved.source,
      roles: tool.roles.slice(),
      installHint: tool.installHint,
    };
  }
  return {
    checkedAt: new Date().toISOString(),
    tools,
    capabilities: {
      commonArchive: Boolean(getCommonArchiveTool(tools)),
      visualNovel: Boolean(tools.garbro.available || tools.gameExtractor.available),
      unity: tools.assetRipper.available,
      gameAudio: tools.vgmstream.available,
      mediaProbe: Boolean(tools.ffprobe.available || tools.ffmpeg.available),
    },
  };
}

async function planExtraction(sourceRoot, records = [], options = {}) {
  const status = await getExtractorStatus(options.toolOverrides || {});
  const planned = [];

  for (const record of records) {
    const relativePath = normalizeRelativePath(record.relativePath || record.path);
    const ext = String(record.ext || path.extname(relativePath).slice(1)).toLowerCase();
    if (!isRoutableExt(ext)) continue;

    try {
      const absolutePath = await resolveExistingInside(sourceRoot, relativePath, "提取路线源文件");
      const signature = await readSignature(absolutePath);
      planned.push(createPlanItem({
        path: relativePath,
        ext,
        size: Number(record.size || 0),
        signature,
        tools: status.tools,
      }));
    } catch (error) {
      planned.push(createUnreadablePlanItem({
        path: relativePath,
        ext,
        size: Number(record.size || 0),
        error,
      }));
    }
  }

  return {
    status,
    routes: planned,
    summary: summarizeRoutes(planned),
  };
}

async function extractCommonArchives({ sourceRoot, outputRoot, resultRootName, records = [], toolOverrides = {} }) {
  const status = await getExtractorStatus(toolOverrides);
  const tools = getCommonArchiveTools(status.tools);
  if (!tools.length) {
    throw new Error("没有找到可用的普通压缩包解包工具，请安装 7-Zip、bsdtar 或 unar。");
  }

  const candidates = await getCommonArchiveCandidates(sourceRoot, records);
  const selected = candidates.slice(0, MAX_COMMON_ARCHIVE_RUN);
  const omitted = Math.max(0, candidates.length - selected.length);

  if (!selected.length) throw new Error("当前没有可由通用工具处理的普通压缩包。");

  const resultRoot = resolveOutputPath(outputRoot, resultRootName, "结果目录");
  const extractRoot = path.join(resultRoot, "10_通用解包输出");
  const rows = [];

  await fs.mkdir(extractRoot, { recursive: true });

  for (const [index, record] of selected.entries()) {
    const sourcePath = await resolveExistingInside(sourceRoot, record.relativePath, "解包源文件");
    const sourceName = path.basename(record.relativePath, path.extname(record.relativePath));
    const targetName = `${String(index + 1).padStart(2, "0")}_${safeSegment(sourceName)}`;
    const targetDir = path.join(extractRoot, targetName);
    assertInside(resultRoot, targetDir, "解包输出目录");

    const attempts = [];
    let extractedRow = null;

    for (const tool of tools) {
      const attemptDir = path.join(
        extractRoot,
        `.attempt_${String(index + 1).padStart(2, "0")}_${safeSegment(tool.id)}_${Date.now()}`,
      );
      assertInside(resultRoot, attemptDir, "解包临时目录");
      await fs.rm(attemptDir, { recursive: true, force: true });
      await fs.mkdir(attemptDir, { recursive: true });
      const command = buildCommonArchiveCommand(tool, sourcePath, attemptDir);
      try {
        const result = await runTool(command.command, command.args, { timeoutMs: 30 * 60 * 1000 });
        const inspection = await inspectExtractedTree(attemptDir);
        await fs.rm(targetDir, { recursive: true, force: true });
        await fs.rename(attemptDir, targetDir);
        attempts.push({ tool: tool.label, status: "ok", message: trimToolOutput(result.stderr || result.stdout) });
        extractedRow = {
          sourcePath: record.relativePath,
          outputPath: path.relative(resultRoot, targetDir).replaceAll(path.sep, "/"),
          status: "extracted",
          tool: tool.label,
          attempts,
          fileCount: inspection.fileCount,
          byteCount: inspection.byteCount,
          message: trimToolOutput(result.stderr || result.stdout),
        };
        break;
      } catch (error) {
        attempts.push({ tool: tool.label, status: "failed", message: trimToolOutput(error.message) });
        await fs.rm(attemptDir, { recursive: true, force: true });
        if (error.policyViolation) break;
      }
    }

    if (extractedRow) {
      rows.push(extractedRow);
    } else {
      rows.push({
        sourcePath: record.relativePath,
        outputPath: path.relative(resultRoot, targetDir).replaceAll(path.sep, "/"),
        status: "failed",
        tool: attempts.map((attempt) => attempt.tool).join(" -> "),
        attempts,
        fileCount: 0,
        byteCount: 0,
        message: attempts.map((attempt) => `${attempt.tool}: ${attempt.message}`).join(" | "),
      });
    }
  }

  await fs.writeFile(path.join(resultRoot, "GalAssetBox_通用解包报告.md"), buildExtractionMarkdown(resultRootName, rows, { omitted }), "utf8");
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_通用解包清单.csv"), buildExtractionCsv(rows), "utf8");

  return {
    resultPath: resultRoot,
    resultRootName,
    tool: tools.map((tool) => tool.label).join(" -> "),
    rows,
    omitted,
    extracted: rows.filter((row) => row.status === "extracted").length,
    failed: rows.filter((row) => row.status === "failed").length,
  };
}

async function getCommonArchiveCandidates(sourceRoot, records = []) {
  const candidates = [];
  for (const record of records) {
    const relativePath = normalizeRelativePath(record.relativePath || record.path);
    const ext = String(record.ext || path.extname(relativePath).slice(1)).toLowerCase();
    const sourcePath = await resolveExistingInside(sourceRoot, relativePath, "通用压缩包候选");
    let signatureLabel = "";
    let isCommonArchive = COMMON_ARCHIVE_EXTS.has(ext);

    if (!isCommonArchive) {
      const detected = detectSignature(await readSignature(sourcePath));
      signatureLabel = detected.label;
      isCommonArchive = detected.commonArchive;
    }

    if (isCommonArchive) {
      candidates.push({
        ...record,
        relativePath,
        ext,
        signature: signatureLabel,
      });
    }
  }
  return candidates;
}

function createUnreadablePlanItem({ path: relativePath, ext, size, error }) {
  return {
    path: relativePath,
    ext,
    size,
    route: "signature-scan",
    label: "读取失败",
    status: "inspect-only",
    tool: "GalAssetBox",
    note: `无法读取文件签名：${trimToolOutput(error.message)}`,
    signature: "unreadable",
  };
}

function createPlanItem({ path: relativePath, ext, size, signature, tools }) {
  const detected = detectSignature(signature);
  let route = "signature-scan";
  let label = "文件签名扫描";
  let status = "inspect-only";
  let tool = "GalAssetBox";
  let note = "可尝试识别裸露图片、音频、视频签名；压缩或加密内容需要专用适配。";

  if (COMMON_ARCHIVE_EXTS.has(ext) || detected.commonArchive) {
    const archiveTool = getCommonArchiveTool(tools);
    route = "common-archive";
    label = "普通压缩包";
    status = archiveTool ? "ready" : "tool-missing";
    tool = archiveTool?.label || "7-Zip / bsdtar / unar";
    note = archiveTool ? "可直接解到独立结果目录，然后再扫描输出。" : "需要安装普通压缩包解包工具。";
  } else if (UNITY_EXTS.has(ext) || detected.unity) {
    route = "unity";
    label = "Unity 资产";
    status = tools.assetRipper.available ? "external-ready" : "tool-missing";
    tool = "AssetRipper";
    note = tools.assetRipper.available ? "已检测到 AssetRipper；自动导出执行器待接入。" : "需要外部 Unity 资产工具。";
  } else if (GAME_AUDIO_EXTS.has(ext)) {
    route = "game-audio";
    label = "游戏音频";
    status = tools.vgmstream.available ? "external-ready" : "tool-missing";
    tool = "vgmstream-cli";
    note = tools.vgmstream.available
      ? "已检测到 vgmstream；自动转码执行器待接入。"
      : tools.ffmpeg.available
        ? "已检测到 ffmpeg，但游戏音频仍需要 vgmstream-cli。"
        : "需要安装游戏音频解码工具 vgmstream-cli。";
  } else if (MEDIA_PROBE_EXTS.has(ext) || detected.media) {
    route = "media-probe";
    label = "音视频探测";
    status = tools.ffprobe.available || tools.ffmpeg.available ? "external-ready" : "tool-missing";
    tool = tools.ffprobe.available ? "ffprobe" : "ffmpeg";
    note = status === "external-ready" ? "已检测到媒体工具；自动探测执行器待接入。" : "需要 ffmpeg / ffprobe。";
  } else if (VN_ARCHIVE_EXTS.has(ext) || detected.visualNovel) {
    route = "visual-novel";
    label = "VN/游戏封包";
    status = tools.garbro.available || tools.gameExtractor.available ? "external-ready" : "adapter-needed";
    tool = tools.garbro.available ? "GARbro" : tools.gameExtractor.available ? "Game Extractor" : "GARbro / Game Extractor / 授权适配器";
    note = status === "external-ready"
      ? "已检测到 VN 工具；自动导出执行器待接入，仍需确认授权。"
      : "扩展名过于泛用，需要按引擎签名选择适配器。";
  }

  return {
    path: relativePath,
    ext,
    size,
    route,
    label,
    status,
    tool,
    note,
    signature: detected.label,
  };
}

function summarizeRoutes(routes) {
  const summary = {
    total: routes.length,
    ready: 0,
    externalReady: 0,
    toolMissing: 0,
    adapterNeeded: 0,
    inspectOnly: 0,
    byRoute: {},
  };

  for (const route of routes) {
    if (route.status === "ready") summary.ready += 1;
    else if (route.status === "external-ready") summary.externalReady += 1;
    else if (route.status === "tool-missing") summary.toolMissing += 1;
    else if (route.status === "adapter-needed") summary.adapterNeeded += 1;
    else summary.inspectOnly += 1;
    summary.byRoute[route.route] = (summary.byRoute[route.route] || 0) + 1;
  }

  return summary;
}

function detectSignature(buffer) {
  const ascii = buffer.toString("latin1");
  const labelParts = [];
  const detected = {
    label: "",
    commonArchive: false,
    visualNovel: false,
    unity: false,
    media: false,
  };

  if (ascii.startsWith("PK\x03\x04") || ascii.startsWith("PK\x05\x06") || ascii.startsWith("PK\x07\x08")) {
    detected.commonArchive = true;
    labelParts.push("ZIP");
  } else if (ascii.startsWith("Rar!\x1A\x07")) {
    detected.commonArchive = true;
    labelParts.push("RAR");
  } else if (buffer.length >= 6 && buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf) {
    detected.commonArchive = true;
    labelParts.push("7Z");
  } else if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    detected.commonArchive = true;
    labelParts.push("GZip");
  } else if (ascii.startsWith("BZh")) {
    detected.commonArchive = true;
    labelParts.push("BZip2");
  } else if (buffer[0] === 0xfd && ascii.slice(1, 6) === "7zXZ\x00") {
    detected.commonArchive = true;
    labelParts.push("XZ");
  } else if (ascii.slice(257, 262) === "ustar") {
    detected.commonArchive = true;
    labelParts.push("TAR");
  }

  if (ascii.startsWith("UnityFS") || ascii.startsWith("UnityWeb") || ascii.startsWith("UnityRaw")) {
    detected.unity = true;
    labelParts.push("Unity");
  }

  if (ascii.startsWith("XP3")) {
    detected.visualNovel = true;
    labelParts.push("KiriKiri XP3");
  } else if (ascii.startsWith("RPA-")) {
    detected.visualNovel = true;
    labelParts.push("Ren'Py RPA");
  } else if (ascii.startsWith("CPK ")) {
    detected.visualNovel = true;
    labelParts.push("CRI CPK");
  }

  if (ascii.startsWith("OggS") || ascii.startsWith("RIFF") || ascii.startsWith("fLaC") || ascii.includes("ftyp")) {
    detected.media = true;
    labelParts.push("Media");
  }

  detected.label = labelParts.join(" / ") || "unknown";
  return detected;
}

function isRoutableExt(ext) {
  return COMMON_ARCHIVE_EXTS.has(ext)
    || VN_ARCHIVE_EXTS.has(ext)
    || UNITY_EXTS.has(ext)
    || GAME_AUDIO_EXTS.has(ext)
    || MEDIA_PROBE_EXTS.has(ext);
}

function getCommonArchiveTool(tools) {
  return [tools.sevenZip, tools.bsdtar, tools.unar].find((tool) => tool?.available) || null;
}

function getCommonArchiveTools(tools) {
  return [tools.sevenZip, tools.bsdtar, tools.unar].filter((tool) => tool?.available);
}

function buildCommonArchiveCommand(tool, sourcePath, targetDir) {
  if (tool.id === "sevenZip") {
    return { command: tool.command, args: ["x", "-y", `-o${targetDir}`, sourcePath] };
  }
  if (tool.id === "unar") {
    return { command: tool.command, args: ["-quiet", "-force-overwrite", "-output-directory", targetDir, sourcePath] };
  }
  return { command: tool.command, args: ["-xf", sourcePath, "-C", targetDir] };
}

async function readSignature(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function getToolDefinitions() {
  return TOOL_DEFS.map((tool) => ({
    id: tool.id,
    label: tool.label,
    roles: tool.roles.slice(),
    installHint: tool.installHint,
  }));
}

function isKnownToolId(toolId) {
  return TOOL_IDS.has(toolId);
}

async function findFirstExecutable(tool, overridePath) {
  const manualPath = String(overridePath || "").trim();
  if (manualPath) {
    const resolved = await resolveManualExecutable(manualPath);
    return {
      command: resolved,
      configured: true,
      source: resolved ? "manual" : "manual-missing",
    };
  }

  for (const command of tool.commands) {
    const resolved = await findExecutable(command);
    if (resolved) {
      return {
        command: resolved,
        configured: false,
        source: "path",
      };
    }
  }
  return {
    command: "",
    configured: false,
    source: "missing",
  };
}

async function resolveManualExecutable(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return "";
    if (process.platform !== "win32") {
      await fs.access(resolved, fsSync.constants.X_OK);
    } else {
      await fs.access(resolved);
    }
    return resolved;
  } catch {
    return "";
  }
}

async function findExecutable(command) {
  if (command.includes(path.sep)) {
    try {
      await fs.access(command);
      return command;
    } catch {
      return "";
    }
  }

  const env = { ...process.env, PATH: buildToolPathEnv() };
  const locator = process.platform === "win32" ? "where.exe" : "which";
  try {
    const { stdout } = await execFileAsync(locator, [command], { env, timeout: 1800, windowsHide: true });
    return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  } catch {
    return "";
  }
}

function buildToolPathEnv() {
  const existing = String(process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const additions = process.platform === "win32"
    ? []
    : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  return [...new Set([...additions, ...existing])].join(path.delimiter);
}

function runTool(command, args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PATH: buildToolPathEnv() },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("外部工具运行超时。"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk.toString("utf8")}`.slice(-16000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-16000);
    });
    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(trimToolOutput(stderr || stdout) || `外部工具退出码 ${code}`));
    });
  });
}

async function inspectExtractedTree(root) {
  const rootRealPath = await fs.realpath(root);
  let fileCount = 0;
  let byteCount = 0;
  const visit = async (current) => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      const stat = await fs.lstat(next);
      const realPath = await fs.realpath(next);
      if (!isInsideOrSame(rootRealPath, realPath)) {
        throw new PolicyViolationError("解包结果包含指向输出目录外的路径。");
      }

      if (stat.isSymbolicLink()) {
        throw new PolicyViolationError("解包结果包含符号链接，请人工确认后再处理。");
      }
      if (stat.isDirectory()) {
        await visit(next);
      } else if (stat.isFile()) {
        fileCount += 1;
        byteCount += stat.size;
        if (fileCount > MAX_EXTRACTED_FILES_PER_ARCHIVE) {
          throw new PolicyViolationError(`单个压缩包解出文件超过 ${MAX_EXTRACTED_FILES_PER_ARCHIVE} 个，已中止。`);
        }
        if (byteCount > MAX_EXTRACTED_BYTES_PER_ARCHIVE) {
          throw new PolicyViolationError(`单个压缩包解出内容超过 ${formatByteLimit(MAX_EXTRACTED_BYTES_PER_ARCHIVE)}，已中止。`);
        }
      }
    }
  };
  await visit(root);
  return { fileCount, byteCount };
}

function buildExtractionMarkdown(resultRootName, rows, { omitted = 0 } = {}) {
  const extracted = rows.filter((row) => row.status === "extracted").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const totalBytes = rows.reduce((sum, row) => sum + Number(row.byteCount || 0), 0);
  const lines = [
    `# ${resultRootName}`,
    "",
    "GalAssetBox 通用解包结果。",
    "",
    "- 只处理用户确认的普通压缩包。",
    "- 输出写入独立目录，可再次作为源目录扫描。",
    `- 单次最多处理 ${MAX_COMMON_ARCHIVE_RUN} 个普通压缩包。`,
    `- 单个压缩包最多 ${MAX_EXTRACTED_FILES_PER_ARCHIVE} 个文件、${formatByteLimit(MAX_EXTRACTED_BYTES_PER_ARCHIVE)} 解包输出。`,
    "- 不处理 DRM、授权绕过、第三方密钥或受保护封包解密。",
    "",
    "## 汇总",
    "",
    `- 成功：${extracted}`,
    `- 失败：${failed}`,
    `- 未处理：${omitted}`,
    `- 已解出大小：${formatByteLimit(totalBytes)}`,
    "",
  ];
  if (omitted > 0) {
    lines.push(`- 本轮还有 ${omitted} 个普通压缩包未处理，请分批运行。`);
    lines.push("");
  }
  lines.push("## 结果", "");
  for (const row of rows) {
    lines.push(`- [${row.status}] ${row.sourcePath} -> ${row.outputPath} | ${row.tool} | ${row.fileCount} files | ${formatByteLimit(row.byteCount || 0)}${row.message ? ` | ${trimToolOutput(row.message)}` : ""}`);
    if (row.attempts?.length) {
      lines.push(`  - 尝试链：${row.attempts.map((attempt) => `${attempt.tool}:${attempt.status}`).join(" -> ")}`);
    }
  }
  return lines.join("\n");
}

function buildExtractionCsv(rows) {
  const header = ["source_path", "output_path", "status", "tool", "file_count", "byte_count", "attempts", "message"];
  return [header, ...rows.map((row) => [
    row.sourcePath,
    row.outputPath,
    row.status,
    row.tool,
    String(row.fileCount),
    String(row.byteCount || 0),
    (row.attempts || []).map((attempt) => `${attempt.tool}:${attempt.status}`).join(" -> "),
    row.message,
  ])].map((row) => row.map(csvCell).join(",")).join("\n");
}

function formatByteLimit(value) {
  if (value >= 1024 * 1024 * 1024) return `${Math.round(value / 1024 / 1024 / 1024)} GB`;
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  return `${value} B`;
}

function trimToolOutput(value) {
  return sanitizeRuntimeText(value).slice(0, 240);
}

function sanitizeRuntimeText(value) {
  return String(value || "")
    .replace(/[A-Za-z]:[\\/](Users|Documents and Settings)[\\/][^\s"'<>|]+/g, "[local-path]")
    .replace(/\/Users\/[^\s"'<>|]+/g, "[local-path]")
    .replace(/\/home\/[^\s"'<>|]+/g, "[local-path]")
    .replace(/\s+/g, " ")
    .trim();
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...normalizeRelative(relativePath));
  if (!isInsideOrSame(root, resolved)) throw new Error("路径超出源目录。");
  return resolved;
}

async function resolveExistingInside(root, relativePath, label) {
  const resolved = resolveInside(root, relativePath);
  const [rootRealPath, targetRealPath] = await Promise.all([
    fs.realpath(root),
    fs.realpath(resolved),
  ]);
  if (!isInsideOrSame(rootRealPath, targetRealPath)) {
    throw new Error(`${label}指向源目录外。`);
  }
  return targetRealPath;
}

function normalizeRelative(relativePath) {
  const parts = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("相对路径不安全。");
  }
  return parts;
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function isInsideOrSame(root, targetPath) {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveOutputPath(root, segment, label) {
  const resolved = path.resolve(root, safeSegment(segment));
  assertInside(root, resolved, label);
  return resolved;
}

function assertInside(root, targetPath, label) {
  if (!isInsideOrSame(root, targetPath)) throw new Error(`${label}超出授权输出目录。`);
}

function safeSegment(value) {
  return String(value || "item")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/\s+$/g, "")
    .slice(0, 120) || "item";
}

module.exports = {
  COMMON_ARCHIVE_EXTS,
  MAX_COMMON_ARCHIVE_RUN,
  getToolDefinitions,
  getExtractorStatus,
  isKnownToolId,
  planExtraction,
  extractCommonArchives,
  _test: {
    safeSegment,
    sanitizeRuntimeText,
    isInsideOrSame,
    inspectExtractedTree,
  },
};
