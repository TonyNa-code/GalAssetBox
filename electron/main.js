const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const {
  extractCommonArchives,
  getExtractorStatus,
  getToolDefinitions,
  isKnownToolId,
  planExtraction,
} = require("./extractor-gateway");

const selectedSourceRoots = new Set();
const selectedOutputRoots = new Set();
const EXTRACTOR_TOOL_CONFIG_FILE = "extractor-tools.json";
const MAX_PLUGIN_OUTPUT_BYTES = 25 * 1024 * 1024;
const MAX_PLUGIN_OUTPUT_TOTAL_BYTES = 100 * 1024 * 1024;
const pluginOutputBytesByResultRoot = new Map();

const SKIPPED_DIRS = new Set([
  ".git",
  "__macosx",
  "node_modules",
  "save",
  "saves",
  "savedata",
  "cache",
  "tmp",
  "temp",
]);

const GENERATED_DIR_PREFIXES = [
  "galassetbox_整理结果",
  "galassetbox_通用解包结果",
  "galassetbox_授权插件结果",
];

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "GalAssetBox",
    backgroundColor: "#f5f4ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("desktop:pick-directory", async (_event, role) => {
  const result = await dialog.showOpenDialog({
    title: role === "output" ? "选择输出文件夹" : "选择游戏文件夹",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const selectedPath = path.resolve(result.filePaths[0]);
  if (role === "output") {
    selectedOutputRoots.add(selectedPath);
  } else {
    selectedSourceRoots.add(selectedPath);
  }
  return {
    canceled: false,
    path: selectedPath,
    name: path.basename(selectedPath) || selectedPath,
  };
});

ipcMain.handle("desktop:scan-directory", async (_event, rootPath) => {
  const files = [];
  const root = assertInsideRegisteredRoot(rootPath, selectedSourceRoots, "扫描目录");
  await walkDirectory(root, root, files);
  return { files };
});

ipcMain.handle("desktop:use-directory-as-source", async (_event, targetPath) => {
  const allowedRoots = new Set([...selectedSourceRoots, ...selectedOutputRoots]);
  const selectedPath = assertInsideRegisteredRoot(targetPath, allowedRoots, "源目录");
  const stat = await fs.stat(selectedPath);
  if (!stat.isDirectory()) {
    throw new Error("目标不是文件夹。");
  }
  selectedSourceRoots.add(selectedPath);
  return {
    path: selectedPath,
    name: path.basename(selectedPath) || selectedPath,
  };
});

ipcMain.handle("desktop:organize-assets", async (_event, payload) => {
  const sourceRoot = assertInsideRegisteredRoot(payload.sourceRootPath, selectedSourceRoots, "源目录");
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = resolveOutputRoot(outputRoot, payload.resultRootName);
  const rows = [];
  let copied = 0;
  let failed = 0;

  await fs.mkdir(resultRoot, { recursive: true });

  for (const record of payload.records || []) {
    try {
      const sourcePath = await resolveExistingInside(sourceRoot, record.relativePath, "整理源文件");
      const targetPath = path.join(
        resultRoot,
        safeSegment(record.categoryFolder),
        ...splitSafe(record.relativePath),
      );
      assertInsideRoot(resultRoot, targetPath, "整理输出");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
      copied += 1;
      rows.push({ relativePath: record.relativePath, status: "copied", message: "" });
    } catch (error) {
      failed += 1;
      rows.push({ relativePath: record.relativePath, status: "failed", message: error.message });
    }
  }

  await fs.writeFile(path.join(resultRoot, "GalAssetBox_整理报告.md"), payload.reports.markdown || "", "utf8");
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_素材清单.csv"), payload.reports.csv || "", "utf8");
  return { copied, failed, rows, resultPath: resultRoot };
});

ipcMain.handle("desktop:read-file-text", async (_event, filePath) => {
  return fs.readFile(await assertExistingInsideRegisteredRoot(filePath, selectedSourceRoots, "读取文件"), "utf8");
});

ipcMain.handle("desktop:read-file-array-buffer", async (_event, filePath) => {
  const buffer = await fs.readFile(await assertExistingInsideRegisteredRoot(filePath, selectedSourceRoots, "读取文件"));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

ipcMain.handle("desktop:write-plugin-output", async (_event, payload) => {
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = resolveOutputRoot(outputRoot, payload.resultRootName);
  const output = payload.output || {};
  const targetPath = path.join(
    resultRoot,
    "10_授权插件输出",
    safeSegment(payload.pluginId),
    "from",
    ...splitSafe(payload.sourcePath),
    ...splitSafe(output.path),
  );
  assertInsideRoot(resultRoot, targetPath, "插件输出");
  const outputBytes = estimateBase64Bytes(output.base64 || "");
  assertPluginOutputBudget(resultRoot, outputBytes);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(output.base64 || "", "base64"));
  pluginOutputBytesByResultRoot.set(resultRoot, (pluginOutputBytesByResultRoot.get(resultRoot) || 0) + outputBytes);
  return path.relative(resultRoot, targetPath).replaceAll(path.sep, "/");
});

ipcMain.handle("desktop:write-plugin-run-reports", async (_event, payload) => {
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = resolveOutputRoot(outputRoot, payload.resultRootName);
  await fs.mkdir(resultRoot, { recursive: true });
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_授权插件报告.md"), payload.markdown || "", "utf8");
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_授权插件清单.csv"), payload.csv || "", "utf8");
  return { ok: true, resultPath: resultRoot };
});

ipcMain.handle("desktop:get-extractor-status", async () => {
  return sanitizeExtractorStatus(await getExtractorStatus(await loadExtractorToolOverrides()));
});

ipcMain.handle("desktop:plan-extraction", async (_event, payload) => {
  const sourceRoot = assertInsideRegisteredRoot(payload.sourceRootPath, selectedSourceRoots, "源目录");
  const plan = await planExtraction(sourceRoot, payload.records || [], {
    toolOverrides: await loadExtractorToolOverrides(),
  });
  return {
    ...plan,
    status: sanitizeExtractorStatus(plan.status),
  };
});

ipcMain.handle("desktop:extract-common-archives", async (_event, payload) => {
  const sourceRoot = assertInsideRegisteredRoot(payload.sourceRootPath, selectedSourceRoots, "源目录");
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  return extractCommonArchives({
    sourceRoot,
    outputRoot,
    resultRootName: safeSegment(payload.resultRootName),
    records: payload.records || [],
    toolOverrides: await loadExtractorToolOverrides(),
  });
});

ipcMain.handle("desktop:pick-extractor-tool", async (_event, toolId) => {
  assertKnownToolId(toolId);
  const tool = getToolDefinitions().find((item) => item.id === toolId);
  const result = await dialog.showOpenDialog({
    title: `选择 ${tool?.label || toolId} 可执行文件`,
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };

  const selectedPath = path.resolve(result.filePaths[0]);
  const overrides = await loadExtractorToolOverrides();
  overrides[toolId] = selectedPath;
  await saveExtractorToolOverrides(overrides);
  return {
    canceled: false,
    toolId,
    name: path.basename(selectedPath),
    status: sanitizeExtractorStatus(await getExtractorStatus(overrides)),
  };
});

ipcMain.handle("desktop:clear-extractor-tool", async (_event, toolId) => {
  assertKnownToolId(toolId);
  const overrides = await loadExtractorToolOverrides();
  delete overrides[toolId];
  await saveExtractorToolOverrides(overrides);
  return {
    ok: true,
    status: sanitizeExtractorStatus(await getExtractorStatus(overrides)),
  };
});

ipcMain.handle("desktop:open-path", async (_event, targetPath) => {
  const allowedRoots = new Set([...selectedSourceRoots, ...selectedOutputRoots]);
  const error = await shell.openPath(assertInsideRegisteredRoot(targetPath, allowedRoots, "打开路径"));
  return { ok: !error, error };
});

async function walkDirectory(root, current, files) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const lower = entry.name.toLowerCase();
      if (SKIPPED_DIRS.has(lower) || isGeneratedOutputDir(lower)) continue;
      await walkDirectory(root, absolutePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(absolutePath);
    files.push({
      path: path.relative(root, absolutePath).replaceAll(path.sep, "/"),
      absolutePath,
      size: stat.size,
    });
  }
}

function isGeneratedOutputDir(lowerName) {
  return GENERATED_DIR_PREFIXES.some((prefix) => lowerName.startsWith(prefix));
}

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...normalizeRelative(relativePath));
  if (!isInsideOrSame(root, resolved)) {
    throw new Error("路径超出源目录。");
  }
  return resolved;
}

async function resolveExistingInside(root, relativePath, label) {
  return assertExistingInsideRoot(root, resolveInside(root, relativePath), label);
}

function assertInsideRegisteredRoot(targetPath, roots, label) {
  const resolved = path.resolve(String(targetPath || ""));
  for (const root of roots) {
    if (isInsideOrSame(root, resolved)) return resolved;
  }
  throw new Error(`${label}不在已选择的授权目录内。`);
}

async function assertExistingInsideRegisteredRoot(targetPath, roots, label) {
  const resolved = path.resolve(String(targetPath || ""));
  for (const root of roots) {
    if (!isInsideOrSame(root, resolved)) continue;
    return assertExistingInsideRoot(root, resolved, label);
  }
  throw new Error(`${label}不在已选择的授权目录内。`);
}

function resolveOutputRoot(outputRoot, resultRootName) {
  const resultRoot = path.resolve(outputRoot, safeSegment(resultRootName));
  assertInsideRoot(outputRoot, resultRoot, "结果目录");
  return resultRoot;
}

function assertInsideRoot(root, targetPath, label) {
  if (!isInsideOrSame(root, targetPath)) {
    throw new Error(`${label}超出授权输出目录。`);
  }
}

async function assertExistingInsideRoot(root, targetPath, label) {
  const [rootRealPath, targetRealPath] = await Promise.all([
    fs.realpath(root),
    fs.realpath(targetPath),
  ]);
  if (!isInsideOrSame(rootRealPath, targetRealPath)) {
    throw new Error(`${label}指向授权目录外。`);
  }
  return targetRealPath;
}

function estimateBase64Bytes(value) {
  const base64 = String(value || "").replace(/\s+/g, "");
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function assertPluginOutputBudget(resultRoot, outputBytes) {
  if (outputBytes > MAX_PLUGIN_OUTPUT_BYTES) {
    throw new Error(`插件单文件输出超过 ${formatByteLimit(MAX_PLUGIN_OUTPUT_BYTES)}。`);
  }
  const used = pluginOutputBytesByResultRoot.get(resultRoot) || 0;
  if (used + outputBytes > MAX_PLUGIN_OUTPUT_TOTAL_BYTES) {
    throw new Error(`插件本次输出超过 ${formatByteLimit(MAX_PLUGIN_OUTPUT_TOTAL_BYTES)}。`);
  }
}

function formatByteLimit(value) {
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  return `${value} B`;
}

function assertKnownToolId(toolId) {
  if (!isKnownToolId(String(toolId || ""))) {
    throw new Error("未知的外部工具 ID。");
  }
}

async function loadExtractorToolOverrides() {
  try {
    const parsed = JSON.parse(await fs.readFile(getExtractorToolConfigPath(), "utf8"));
    if (!parsed || typeof parsed !== "object") return {};
    const overrides = {};
    for (const [toolId, toolPath] of Object.entries(parsed)) {
      if (isKnownToolId(toolId) && typeof toolPath === "string" && toolPath.trim()) {
        overrides[toolId] = toolPath;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

async function saveExtractorToolOverrides(overrides) {
  const configPath = getExtractorToolConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(overrides, null, 2), "utf8");
}

function getExtractorToolConfigPath() {
  return path.join(app.getPath("userData"), EXTRACTOR_TOOL_CONFIG_FILE);
}

function sanitizeExtractorStatus(status) {
  const tools = {};
  for (const [toolId, tool] of Object.entries(status?.tools || {})) {
    tools[toolId] = {
      id: tool.id,
      label: tool.label,
      commandName: tool.commandName || "",
      available: Boolean(tool.available),
      configured: Boolean(tool.configured),
      source: tool.source || "missing",
      roles: Array.isArray(tool.roles) ? tool.roles.slice() : [],
      installHint: tool.installHint || "",
    };
  }
  return {
    checkedAt: status?.checkedAt || new Date().toISOString(),
    tools,
    capabilities: { ...(status?.capabilities || {}) },
  };
}

function isInsideOrSame(root, targetPath) {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelative(relativePath) {
  const parts = String(relativePath || "").replaceAll("\\", "/").split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("相对路径不安全。");
  }
  return parts;
}

function splitSafe(relativePath) {
  return normalizeRelative(relativePath).map(safeSegment);
}

function safeSegment(value) {
  return String(value || "item")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/\s+$/g, "")
    .slice(0, 120) || "item";
}
