const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const selectedSourceRoots = new Set();
const selectedOutputRoots = new Set();

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

ipcMain.handle("desktop:organize-assets", async (_event, payload) => {
  const sourceRoot = assertInsideRegisteredRoot(payload.sourceRootPath, selectedSourceRoots, "源目录");
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = path.join(outputRoot, safeSegment(payload.resultRootName));
  const rows = [];
  let copied = 0;
  let failed = 0;

  await fs.mkdir(resultRoot, { recursive: true });

  for (const record of payload.records || []) {
    try {
      const sourcePath = resolveInside(sourceRoot, record.relativePath);
      const targetPath = path.join(
        resultRoot,
        safeSegment(record.categoryFolder),
        ...splitSafe(record.relativePath),
      );
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
  return fs.readFile(assertInsideRegisteredRoot(filePath, selectedSourceRoots, "读取文件"), "utf8");
});

ipcMain.handle("desktop:read-file-array-buffer", async (_event, filePath) => {
  const buffer = await fs.readFile(assertInsideRegisteredRoot(filePath, selectedSourceRoots, "读取文件"));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

ipcMain.handle("desktop:write-plugin-output", async (_event, payload) => {
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = path.join(outputRoot, safeSegment(payload.resultRootName));
  const output = payload.output || {};
  const targetPath = path.join(
    resultRoot,
    "10_授权插件输出",
    safeSegment(payload.pluginId),
    "from",
    ...splitSafe(payload.sourcePath),
    ...splitSafe(output.path),
  );
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(output.base64 || "", "base64"));
  return path.relative(resultRoot, targetPath).replaceAll(path.sep, "/");
});

ipcMain.handle("desktop:write-plugin-run-reports", async (_event, payload) => {
  const outputRoot = assertInsideRegisteredRoot(payload.outputRootPath, selectedOutputRoots, "输出目录");
  const resultRoot = path.join(outputRoot, safeSegment(payload.resultRootName));
  await fs.mkdir(resultRoot, { recursive: true });
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_授权插件报告.md"), payload.markdown || "", "utf8");
  await fs.writeFile(path.join(resultRoot, "GalAssetBox_授权插件清单.csv"), payload.csv || "", "utf8");
  return { ok: true, resultPath: resultRoot };
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
      if (SKIPPED_DIRS.has(lower) || lower.startsWith("galassetbox_整理结果")) continue;
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

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, ...normalizeRelative(relativePath));
  if (!isInsideOrSame(root, resolved)) {
    throw new Error("路径超出源目录。");
  }
  return resolved;
}

function assertInsideRegisteredRoot(targetPath, roots, label) {
  const resolved = path.resolve(String(targetPath || ""));
  for (const root of roots) {
    if (isInsideOrSame(root, resolved)) return resolved;
  }
  throw new Error(`${label}不在已选择的授权目录内。`);
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
    .replace(/[<>:"\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+$/g, "")
    .slice(0, 120) || "item";
}
