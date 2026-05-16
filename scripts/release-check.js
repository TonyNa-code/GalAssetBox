#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const skipDirs = new Set([".git", "node_modules", "dist", "release", ".playwright-cli"]);
const textExts = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".gitignore",
]);

const slashUsers = `/${"Users"}/`;
const slashHome = `/${"home"}/`;
const windowsUserPath = /[A-Za-z]:[\\/](Users|Documents and Settings)[\\/][^\s"'<>]+/;
const oldProjectTerms = [`Gal${"Aid"}`, `启动${"医生"}`];
const assistantTranscriptTerms = [`作为${"AI"}`, `我是${"AI"}`, `Chat${"GPT"}`, `用户${"说"}`];
const privatePatterns = [
  { label: "macOS user path", test: (text) => text.includes(slashUsers) },
  { label: "Linux user path", test: (text) => text.includes(slashHome) },
  { label: "Windows user path", test: (text) => windowsUserPath.test(text) },
  { label: "old project name", test: (text) => oldProjectTerms.some((term) => text.includes(term)) },
  { label: "private email", test: (text) => /[A-Z0-9._%+-]+@(gmail|qq|163|126|icloud|outlook|hotmail)\./i.test(text) },
  {
    label: "assistant transcript wording",
    test: (text) => assistantTranscriptTerms.some((term) => text.includes(term)) || /Codex.*帮你/.test(text),
  },
];

const requiredFiles = [
  "index.html",
  "src/app.js",
  "src/plugin-host.js",
  "src/authorized-plugins.js",
  "src/styles.css",
  "electron/main.js",
  "electron/preload.js",
  "docs/SAFETY.md",
  "docs/PLUGIN_API.md",
  "docs/WINDOWS.md",
  "docs/小白版使用说明.md",
  ".github/workflows/build-desktop.yml",
  "docs/RELEASE_CHECKLIST.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "scripts/release-check.js",
];

const checks = [];
const failures = [];
const warnings = [];

function pass(label) {
  checks.push({ label, ok: true });
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
  failures.push(`${label}: ${detail}`);
}

function warn(label, detail) {
  warnings.push(`${label}: ${detail}`);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function walk(currentDir, files = []) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(path.join(currentDir, entry.name), files);
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(path.join(currentDir, entry.name));
  }
  return files;
}

function isTextFile(filePath) {
  const name = path.basename(filePath);
  const ext = path.extname(name).toLowerCase();
  return textExts.has(ext) || textExts.has(name);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function checkRequiredFiles() {
  const missing = requiredFiles.filter((file) => !fileExists(file));
  if (missing.length) fail("required files", `missing ${missing.join(", ")}`);
  else pass("required files");
}

function checkPackageScripts() {
  const pkg = JSON.parse(readText("package.json"));
  const requiredScripts = ["check", "release:check", "pack", "dist", "dist:win", "pack:win"];
  const missing = requiredScripts.filter((script) => !pkg.scripts?.[script]);
  if (missing.length) fail("package scripts", `missing ${missing.join(", ")}`);
  else pass("package scripts");

  if (pkg.devDependencies?.electron && pkg.devDependencies.electron !== "latest") pass("electron version pinned");
  else fail("electron version pinned", "electron must not use latest");

  if (pkg.devDependencies?.["electron-builder"] && pkg.devDependencies["electron-builder"] !== "latest") {
    pass("electron-builder version pinned");
  } else {
    fail("electron-builder version pinned", "electron-builder must not use latest");
  }
}

function checkElectronSafety() {
  const main = readText("electron/main.js");
  const preload = readText("electron/preload.js");
  const requiredSnippets = [
    ["contextIsolation: true", main],
    ["nodeIntegration: false", main],
    ["sandbox: true", main],
    ["assertInsideRegisteredRoot", main],
    ["selectedSourceRoots", main],
    ["selectedOutputRoots", main],
    ["contextBridge.exposeInMainWorld", preload],
    ["GalAssetBoxDesktop", preload],
  ];
  const missing = requiredSnippets.filter(([snippet, text]) => !text.includes(snippet)).map(([snippet]) => snippet);
  if (missing.length) fail("electron safety bridge", `missing ${missing.join(", ")}`);
  else pass("electron safety bridge");
}

function checkSafetyBoundary() {
  const files = ["README.md", "docs/SAFETY.md", "docs/PLUGIN_API.md", "src/app.js", "src/plugin-host.js"];
  const combined = files.map(readText).join("\n");
  const requiredTerms = ["noDrmBypass", "noBundledThirdPartyKeys", "不拆包", "不解密", "DRM"];
  const missing = requiredTerms.filter((term) => !combined.includes(term));
  if (missing.length) fail("safety boundary wording", `missing ${missing.join(", ")}`);
  else pass("safety boundary wording");
}

function checkWindowsPackaging() {
  const workflow = readText(".github/workflows/build-desktop.yml");
  const docs = readText("docs/WINDOWS.md");
  const pkg = readText("package.json");
  const requiredSnippets = [
    ["npm run dist:win", workflow],
    ["windows-latest", workflow],
    ["upload-artifact", workflow],
    ["npm run dist:win", docs],
    ['"dist:win"', pkg],
    ['"win"', pkg],
    ["nsis", pkg],
    ["zip", pkg],
  ];
  const missing = requiredSnippets.filter(([snippet, text]) => !text.includes(snippet)).map(([snippet]) => snippet);
  if (missing.length) fail("windows packaging", `missing ${missing.join(", ")}`);
  else pass("windows packaging");

  if (/unverified|clean Windows|Windows machine|真机/i.test(docs)) pass("windows verification caveat");
  else warn("windows verification caveat", "docs should say runtime still needs Windows testing");
}

function checkUserFacingHelpers() {
  const app = readText("src/app.js");
  const requiredSnippets = [
    "buildHelpSummaryMarkdown",
    "downloadHelpSummary",
    "renderPreflightSummary",
    "renderCategoryRulePanel",
    "GalAssetBox.category.rules.v1",
  ];
  const missing = requiredSnippets.filter((snippet) => !app.includes(snippet));
  if (missing.length) fail("user-facing helper features", `missing ${missing.join(", ")}`);
  else pass("user-facing helper features");
}

function checkPrivacyText() {
  const hits = [];
  for (const filePath of walk(root)) {
    if (!isTextFile(filePath)) continue;
    const rel = relative(filePath);
    if (rel === "scripts/release-check.js") continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const pattern of privatePatterns) {
      if (pattern.test(text)) hits.push(`${rel} (${pattern.label})`);
    }
  }
  if (hits.length) fail("privacy text scan", hits.slice(0, 20).join("; "));
  else pass("privacy text scan");
}

function checkGeneratedOutputIgnored() {
  const gitignore = readText(".gitignore");
  const required = ["node_modules/", "dist/", "release/", "*.log"];
  const missing = required.filter((entry) => !gitignore.includes(entry));
  if (missing.length) fail("generated output ignored", `missing ${missing.join(", ")}`);
  else pass("generated output ignored");
}

function main() {
  checkRequiredFiles();
  checkPackageScripts();
  checkElectronSafety();
  checkSafetyBoundary();
  checkWindowsPackaging();
  checkUserFacingHelpers();
  checkPrivacyText();
  checkGeneratedOutputIgnored();

  for (const check of checks) {
    const marker = check.ok ? "ok" : "fail";
    console.log(`${marker} - ${check.label}${check.detail ? `: ${check.detail}` : ""}`);
  }
  for (const item of warnings) console.log(`warn - ${item}`);

  if (failures.length) {
    console.error(`\nrelease check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }
  console.log(`\nrelease check passed: ${checks.length} checks, ${warnings.length} warning(s).`);
}

main();
