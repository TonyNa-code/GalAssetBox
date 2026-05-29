const pickSourceButton = document.querySelector("#pickSourceButton");
const pickOutputButton = document.querySelector("#pickOutputButton");
const scanButton = document.querySelector("#scanButton");
const organizeButton = document.querySelector("#organizeButton");
const runPluginsButton = document.querySelector("#runPluginsButton");
const importPluginButton = document.querySelector("#importPluginButton");
const importPluginPackageButton = document.querySelector("#importPluginPackageButton");
const helpSummaryButton = document.querySelector("#helpSummaryButton");
const manifestOnlyButton = document.querySelector("#manifestOnlyButton");
const sampleButton = document.querySelector("#sampleButton");
const beginnerModeButton = document.querySelector("#beginnerModeButton");
const advancedModeButton = document.querySelector("#advancedModeButton");
const modeSwitch = document.querySelector("#modeSwitch");
const modeHelp = document.querySelector("#modeHelp");
const actionHint = document.querySelector("#actionHint");
const importPluginInput = document.querySelector("#importPluginInput");
const importPluginPackageInput = document.querySelector("#importPluginPackageInput");
const manifestInput = document.querySelector("#manifestInput");
const sourceName = document.querySelector("#sourceName");
const outputName = document.querySelector("#outputName");
const sourcePathBox = document.querySelector("#sourcePathBox");
const outputPathBox = document.querySelector("#outputPathBox");
const sourceState = document.querySelector("#sourceState");
const outputState = document.querySelector("#outputState");
const categoryPresets = document.querySelector("#categoryPresets");
const categoryPresetHint = document.querySelector("#categoryPresetHint");
const categoryOptions = document.querySelector("#categoryOptions");
const categorySelectionSummary = document.querySelector("#categorySelectionSummary");
const projectTitle = document.querySelector("#projectTitle");
const statusPill = document.querySelector("#statusPill");
const selectedAssetCount = document.querySelector("#selectedAssetCount");
const copySize = document.querySelector("#copySize");
const archiveCount = document.querySelector("#archiveCount");
const textCount = document.querySelector("#textCount");
const progressPanel = document.querySelector("#progressPanel");
const progressTitle = document.querySelector("#progressTitle");
const progressDetail = document.querySelector("#progressDetail");
const progressTrack = document.querySelector("#progressTrack");
const progressBar = document.querySelector("#progressBar");
const overviewPanel = document.querySelector("#overviewPanel");
const categoriesPanel = document.querySelector("#categoriesPanel");
const archivesPanel = document.querySelector("#archivesPanel");
const authorizedPluginsPanel = document.querySelector("#authorizedPluginsPanel");
const logPanel = document.querySelector("#logPanel");
const emptyTemplate = document.querySelector("#emptyTemplate");
const desktopBridge = window.GalAssetBoxDesktop || null;

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "bmp", "webp", "gif", "tga", "dds"]);
const AUDIO_EXTS = new Set(["ogg", "mp3", "wav", "flac", "m4a", "aac", "opus", "mid", "midi"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "avi", "wmv", "mpg", "mpeg", "mkv", "mov"]);
const TEXT_EXTS = new Set(["txt", "ks", "rpy", "rpyc", "json", "csv", "xml", "ini", "lua", "js", "po", "yaml", "yml"]);
const ARCHIVE_EXTS = new Set(["xp3", "rpa", "rpi", "nsa", "ns2", "sar", "arc", "pck", "dat", "pak", "wolf", "unity3d", "assets"]);
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
const MAX_PLUGIN_FILE_BYTES = 1024 * 1024;
const MAX_PLUGIN_PACKAGE_BYTES = 2 * 1024 * 1024;
const UI_MODE_STORAGE_KEY = "GalAssetBox.ui.mode.v1";
const CUSTOM_RULES_STORAGE_KEY = "GalAssetBox.category.rules.v1";
const CATEGORY_SELECTION_STORAGE_KEY = "GalAssetBox.category.selection.v1";
const MAX_VISIBLE_TOASTS = 3;
const TOAST_DURATION_MS = 2600;
const TOAST_DISMISS_LABEL_MAX_CHARS = 72;
const PLUGIN_PACKAGE_SAFETY_FLAGS = [
  "requiresUserAuthorization",
  "localOnly",
  "noDrmBypass",
  "noBundledThirdPartyKeys",
];

const CATEGORY_DEFS = [
  { id: "cg", label: "CG", folder: "01_CG", defaultEnabled: true },
  { id: "sprites", label: "立绘", folder: "02_立绘", defaultEnabled: true },
  { id: "backgrounds", label: "背景", folder: "03_背景", defaultEnabled: true },
  { id: "images", label: "其他图片", folder: "04_其他图片", defaultEnabled: true },
  { id: "music", label: "音乐", folder: "05_音乐", defaultEnabled: true },
  { id: "voice", label: "语音", folder: "06_语音", defaultEnabled: true },
  { id: "sound", label: "音效", folder: "07_音效", defaultEnabled: true },
  { id: "video", label: "视频", folder: "08_视频", defaultEnabled: true },
  { id: "text", label: "文本脚本", folder: "09_文本脚本", defaultEnabled: true },
];

const CATEGORY_PRESETS = {
  all: CATEGORY_DEFS.map((category) => category.id),
  images: ["cg", "sprites", "backgrounds", "images"],
  audio: ["music", "voice", "sound"],
  video: ["video"],
  text: ["text"],
};

const CATEGORY_BY_ID = new Map(CATEGORY_DEFS.map((category) => [category.id, category]));
let customCategoryRules = loadCustomCategoryRules();
const SAMPLE_RECORDS = [
  sampleRecord("game/ev/ev001.png", 1284000),
  sampleRecord("game/ev/ev002.png", 1402000),
  sampleRecord("game/fg/heroine/smile.png", 864000),
  sampleRecord("game/fg/heroine/angry.png", 846000),
  sampleRecord("game/bg/classroom.jpg", 1900000),
  sampleRecord("game/bgm/opening.ogg", 6400000),
  sampleRecord("game/voice/heroine_001.ogg", 420000),
  sampleRecord("game/se/click.wav", 52000),
  sampleRecord("game/movie/op.webm", 22800000),
  sampleRecord("game/scenario/route_a.ks", 62000),
  sampleRecord("game/authorized/demo.gabpack.json", 610),
  sampleRecord("game/data.xp3", 542000000),
  sampleRecord("game/archive.rpa", 184000000),
];

let sourceHandle = null;
let outputHandle = null;
let desktopSource = null;
let desktopOutput = null;
let currentRecords = [];
let currentLog = [];
let uiMode = loadUiMode();
let lastOrganizeRun = null;
let lastPluginRun = null;
let busy = false;
const toastControllers = new WeakMap();

function sampleRecord(path, size) {
  const record = makeRecord({ path, size, handle: null });
  return record;
}

function makeRecord({ path, size, handle, desktopSourcePath = "" }) {
  const normalized = normalizePath(path);
  const name = getBaseName(normalized);
  const ext = getExt(name);
  const category = categorizePath(normalized, ext);
  return {
    path: normalized,
    name,
    ext,
    size: size || 0,
    handle,
    desktopSourcePath,
    category,
    action: category.copy ? "copy" : category.id === "archive" ? "index-only" : "skip",
  };
}

function normalizePath(path) {
  return String(path || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function getBaseName(path) {
  return normalizePath(path).split("/").filter(Boolean).pop() || "";
}

function getExt(name) {
  const index = String(name || "").lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDateTimeCompact(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function nowStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function setProgress(title, detail, progress = 0, tone = "neutral") {
  const boundedProgress = Math.max(0, Math.min(100, progress));
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
  progressTrack.setAttribute("aria-valuenow", String(Math.round(boundedProgress)));
  progressTrack.setAttribute("aria-valuetext", `${Math.round(boundedProgress)}%`);
  progressBar.style.width = `${boundedProgress}%`;
  progressPanel.className = `progress-panel ${tone}`;
}

function setStatus(label, className = "neutral") {
  statusPill.textContent = label;
  statusPill.className = `status-pill ${className}`;
}

function setBusy(isBusy) {
  busy = isBusy;
  [
    pickSourceButton,
    pickOutputButton,
    scanButton,
    organizeButton,
    runPluginsButton,
    importPluginButton,
    importPluginPackageButton,
    helpSummaryButton,
    manifestOnlyButton,
    sampleButton,
    beginnerModeButton,
    advancedModeButton,
    ...categoryPresets.querySelectorAll("button"),
  ].forEach((button) => {
    button.disabled = isBusy;
  });
  updateActionState();
}

function updateActionState() {
  const hasDirectoryPicker = "showDirectoryPicker" in window;
  const hasSource = Boolean(sourceHandle || desktopSource);
  const hasOutput = Boolean(outputHandle || desktopOutput);
  const selectedCopyCount = getSelectedCopyRecords().length;
  const hasSelectedCopyRecords = !currentRecords.length || selectedCopyCount > 0;
  pickSourceButton.disabled = busy || (!hasDirectoryPicker && !desktopBridge);
  pickOutputButton.disabled = busy || (!hasDirectoryPicker && !desktopBridge);
  scanButton.disabled = busy || !hasSource;
  organizeButton.disabled = busy || !hasSource || !hasOutput || !hasSelectedCopyRecords;
  runPluginsButton.disabled = busy || !hasSource || !hasOutput;
  importPluginButton.disabled = busy;
  importPluginPackageButton.disabled = busy;
  helpSummaryButton.disabled = busy || !currentRecords.length;
  beginnerModeButton.disabled = busy;
  advancedModeButton.disabled = busy;
  updateFolderStatus(hasSource, hasOutput);
  updateActionHint(hasSource, hasOutput);
  updatePrimaryActionLabels(hasSource, selectedCopyCount);
}

function updatePrimaryActionLabels(hasSource, selectedCopyCount) {
  scanButton.textContent = hasSource && currentRecords.length ? "重新扫描素材" : "扫描素材";
  if (!hasSource || !currentRecords.length) {
    organizeButton.textContent = "开始整理";
  } else if (!selectedCopyCount) {
    organizeButton.textContent = "无可整理素材";
  } else {
    organizeButton.textContent = `整理 ${formatNumber(selectedCopyCount)} 个素材`;
  }
}

function updateFolderStatus(hasSource, hasOutput) {
  const sourceLabel = sourceName.textContent.trim();
  const sourcePreview = sourceLabel === "样例" || sourceLabel === "清单模式";
  sourcePathBox.dataset.state = hasSource ? "ready" : sourcePreview ? "preview" : "empty";
  outputPathBox.dataset.state = hasOutput ? "ready" : "empty";
  sourceState.textContent = hasSource ? "已选择" : sourcePreview ? "预览模式" : "待选择";
  outputState.textContent = hasOutput ? "已选择" : "整理前选择";
}

function updateActionHint(hasSource, hasOutput) {
  const sourceLabel = sourceName.textContent.trim();
  const isPreview = sourceLabel === "样例" || sourceLabel === "清单模式";
  const hasRecords = currentRecords.length > 0;
  const selectedCopyCount = hasRecords ? getSelectedCopyRecords().length : 0;
  let state = "blocked";
  let message = "先选择游戏文件夹。";

  if (busy) {
    state = "busy";
    message = "正在处理当前任务，请稍等。";
  } else if (sourceLabel === "样例") {
    state = "preview";
    message = "当前是样例预览；整理真实素材前请先选择游戏文件夹。";
  } else if (sourceLabel === "清单模式" || (!hasSource && hasRecords)) {
    state = "preview";
    message = "当前来自文件清单；可导出求助摘要，直接整理需选择真实源目录。";
  } else if (hasSource && !hasRecords) {
    state = "ready";
    message = "源目录已选择，下一步扫描素材。";
  } else if (hasSource && hasRecords && !selectedCopyCount) {
    state = "blocked";
    message = "当前勾选类型里没有可整理素材，请重新勾选类型或查看封包提示。";
  } else if (hasSource && hasRecords && !hasOutput) {
    state = "warn";
    message = "扫描完成；选择输出文件夹后即可开始整理。";
  } else if (hasSource && hasOutput) {
    state = "ready";
    message = hasRecords ? "准备就绪，可以开始整理。" : "文件夹已选择，先扫描素材。";
  }

  actionHint.dataset.state = state;
  actionHint.textContent = message;
}

function loadUiMode() {
  try {
    return window.localStorage.getItem(UI_MODE_STORAGE_KEY) === "advanced" ? "advanced" : "beginner";
  } catch {
    return "beginner";
  }
}

function setUiMode(nextMode) {
  uiMode = nextMode === "advanced" ? "advanced" : "beginner";
  try {
    window.localStorage.setItem(UI_MODE_STORAGE_KEY, uiMode);
  } catch {
    // Local storage can be unavailable in some locked-down browsers.
  }
  applyUiMode();
}

function applyUiMode() {
  document.body.dataset.mode = uiMode;
  beginnerModeButton.classList.toggle("active", uiMode === "beginner");
  advancedModeButton.classList.toggle("active", uiMode === "advanced");
  beginnerModeButton.setAttribute("aria-pressed", uiMode === "beginner" ? "true" : "false");
  advancedModeButton.setAttribute("aria-pressed", uiMode === "advanced" ? "true" : "false");
  modeHelp.textContent = uiMode === "advanced"
    ? "显示插件、诊断、样例和清单等高级功能。"
    : "只显示最常用的整理流程。";
}

function loadCustomCategoryRules() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_RULES_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCustomRule)
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function saveCustomCategoryRules() {
  try {
    window.localStorage.setItem(CUSTOM_RULES_STORAGE_KEY, JSON.stringify(customCategoryRules));
  } catch {
    // Rules are a convenience layer; the app still works if storage is blocked.
  }
}

function normalizeCustomRule(rule) {
  const keyword = String(rule?.keyword || "").trim().replaceAll("\\", "/").toLowerCase();
  const categoryId = String(rule?.categoryId || "");
  if (keyword.length < 2 || keyword.length > 60 || !CATEGORY_BY_ID.has(categoryId)) return null;
  return {
    id: String(rule?.id || `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    keyword,
    categoryId,
  };
}

function findCustomCategoryId(path, ext) {
  if (!isOpenAssetExt(ext)) return "";
  const lower = normalizePath(path).toLowerCase();
  const matched = customCategoryRules.find((rule) => lower.includes(rule.keyword));
  return matched?.categoryId || "";
}

function isOpenAssetExt(ext) {
  return IMAGE_EXTS.has(ext) || AUDIO_EXTS.has(ext) || VIDEO_EXTS.has(ext) || TEXT_EXTS.has(ext);
}

function reapplyCategoryRules() {
  currentRecords = currentRecords.map((record) => {
    const nextCategory = categorizePath(record.path, record.ext);
    return {
      ...record,
      category: nextCategory,
      action: nextCategory.copy ? "copy" : nextCategory.id === "archive" ? "index-only" : "skip",
    };
  });
}

function addCustomCategoryRule(keyword, categoryId) {
  const normalized = normalizeCustomRule({ keyword, categoryId });
  if (!normalized) {
    showToast("规则至少输入 2 个字，并选择一个有效分类");
    return;
  }
  if (customCategoryRules.some((rule) => rule.keyword === normalized.keyword && rule.categoryId === normalized.categoryId)) {
    showToast("这条分类规则已经存在");
    return;
  }
  if (customCategoryRules.length >= 20) {
    showToast("最多保留 20 条分类规则");
    return;
  }
  customCategoryRules = [...customCategoryRules, normalized];
  saveCustomCategoryRules();
  reapplyCategoryRules();
  currentLog.push(`已添加分类规则：包含 ${normalized.keyword} -> ${CATEGORY_BY_ID.get(normalized.categoryId).label}`);
  render();
}

function removeCustomCategoryRule(ruleId) {
  const before = customCategoryRules.length;
  customCategoryRules = customCategoryRules.filter((rule) => rule.id !== ruleId);
  if (customCategoryRules.length === before) return;
  saveCustomCategoryRules();
  reapplyCategoryRules();
  currentLog.push("已移除一条分类规则并重新统计。");
  render();
}

function categorizePath(path, ext) {
  const lower = `/${normalizePath(path).toLowerCase()}`;
  const cleanName = getBaseName(lower);

  if (ARCHIVE_EXTS.has(ext)) {
    return {
      id: "archive",
      label: "封包提示",
      folder: "封包提示_不复制",
      copy: false,
      reason: "资源封包只记录清单，不解密、不拆包。",
    };
  }

  const customCategoryId = findCustomCategoryId(lower, ext);
  if (customCategoryId) return category(customCategoryId);

  if (IMAGE_EXTS.has(ext)) {
    if (/(\/|_)(ev|event|cg|gallery|album|scene|still|イベント|一枚絵|差分)(\/|_|\.|$)/i.test(lower)) {
      return category("cg");
    }
    if (/(\/|_)(fg|chara|character|sprite|stand|tachie|face|立绘|表情|人物)(\/|_|\.|$)/i.test(lower)) {
      return category("sprites");
    }
    if (/(\/|_)(bg|background|back|背景)(\/|_|\.|$)/i.test(lower)) {
      return category("backgrounds");
    }
    if (/^icon|cursor|button|window|frame/.test(cleanName)) {
      return category("images");
    }
    return category("images");
  }

  if (AUDIO_EXTS.has(ext)) {
    if (/(\/|_)(voice|vo|cv|voices|语音|ボイス)(\/|_|\.|$)/i.test(lower)) return category("voice");
    if (/(\/|_)(se|sfx|sound|sounds|effect|音效)(\/|_|\.|$)/i.test(lower)) return category("sound");
    return category("music");
  }

  if (VIDEO_EXTS.has(ext)) return category("video");
  if (TEXT_EXTS.has(ext)) return category("text");

  return {
    id: "ignored",
    label: "未整理",
    folder: "未整理",
    copy: false,
    reason: "不是当前开放素材类型。",
  };
}

function category(id) {
  const definition = CATEGORY_BY_ID.get(id);
  return { ...definition, copy: true, reason: "开放格式，可复制整理。" };
}

function selectedCategoryIds() {
  return new Set(
    [...categoryOptions.querySelectorAll("input[type='checkbox']")]
      .filter((input) => input.checked)
      .map((input) => input.value),
  );
}

function defaultCategoryIds() {
  return CATEGORY_DEFS
    .filter((category) => category.defaultEnabled)
    .map((category) => category.id);
}

function loadCategorySelection() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CATEGORY_SELECTION_STORAGE_KEY) || "null");
    if (!Array.isArray(parsed)) return new Set(defaultCategoryIds());
    const validIds = new Set(CATEGORY_DEFS.map((category) => category.id));
    return new Set(parsed.filter((id) => validIds.has(id)));
  } catch {
    return new Set(defaultCategoryIds());
  }
}

function saveCategorySelection() {
  try {
    window.localStorage.setItem(CATEGORY_SELECTION_STORAGE_KEY, JSON.stringify([...selectedCategoryIds()]));
  } catch {
    // Category selection is a convenience preference; the app still works without storage.
  }
}

function getFilledCategoryIds() {
  const metrics = getCategoryMetrics();
  return CATEGORY_DEFS
    .filter((category) => (metrics.get(category.id)?.count || 0) > 0)
    .map((category) => category.id);
}

function getCategoryPresetIds(presetId) {
  if (presetId === "filled") return getFilledCategoryIds();
  return CATEGORY_PRESETS[presetId] || [];
}

function setSelectedCategoryIds(ids) {
  const selectedIds = new Set(ids);
  categoryOptions.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = selectedIds.has(input.value);
  });
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function updateCategoryPresetState() {
  const selectedIds = selectedCategoryIds();
  let activeLabel = "";
  categoryPresets.querySelectorAll("[data-category-preset]").forEach((button) => {
    const presetId = button.dataset.categoryPreset || "";
    const presetIds = new Set(getCategoryPresetIds(presetId));
    const unavailable = presetId === "filled" && !currentRecords.length;
    const active = !unavailable && sameSet(selectedIds, presetIds);
    button.disabled = busy || unavailable;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    if (active) activeLabel = button.textContent.trim();
  });
  if (!selectedIds.size) {
    categoryPresetHint.dataset.state = "blocked";
    categoryPresetHint.textContent = "当前：未选择类型";
  } else if (activeLabel) {
    categoryPresetHint.dataset.state = "preset";
    categoryPresetHint.textContent = `当前预设：${activeLabel}`;
  } else {
    categoryPresetHint.dataset.state = "custom";
    categoryPresetHint.textContent = "当前：自定义选择";
  }
}

function applyCategoryPreset(presetId) {
  const ids = getCategoryPresetIds(presetId);
  if (!ids.length) {
    if (presetId === "filled") showToast("扫描后才能选择有素材类型");
    return;
  }
  setSelectedCategoryIds(ids);
  saveCategorySelection();
  updateActionState();
  render();
}

function moveFocusInButtonGroup(group, currentButton, key) {
  const buttons = [...group.querySelectorAll("button")].filter((button) => !button.disabled);
  if (!buttons.length) return;
  const currentIndex = Math.max(0, buttons.indexOf(currentButton));
  const nextIndex = key === "Home"
    ? 0
    : key === "End"
      ? buttons.length - 1
      : key === "ArrowRight" || key === "ArrowDown"
        ? (currentIndex + 1) % buttons.length
        : (currentIndex - 1 + buttons.length) % buttons.length;
  buttons[nextIndex].focus();
}

function getCategoryMetrics() {
  const metrics = new Map(CATEGORY_DEFS.map((definition) => [
    definition.id,
    { count: 0, size: 0 },
  ]));
  for (const record of currentRecords) {
    const metric = metrics.get(record.category.id);
    if (!metric) continue;
    metric.count += 1;
    metric.size += record.size;
  }
  return metrics;
}

function updateCategoryOptionMetrics() {
  const metrics = getCategoryMetrics();
  for (const definition of CATEGORY_DEFS) {
    const option = categoryOptions.querySelector(`[data-category-option="${definition.id}"]`);
    if (!(option instanceof HTMLElement)) continue;
    const count = option.querySelector("[data-category-count]");
    const size = option.querySelector("[data-category-size]");
    const metric = metrics.get(definition.id) || { count: 0, size: 0 };
    option.dataset.empty = metric.count ? "false" : "true";
    if (count) count.textContent = formatNumber(metric.count);
    if (size) size.textContent = metric.count ? formatBytes(metric.size) : "0 B";
  }
}

function updateCategorySelectionSummary() {
  const copyRecords = currentRecords.filter((record) => record.category.copy);
  const selected = getSelectedCopyRecords();
  const selectedSize = selected.reduce((sum, record) => sum + record.size, 0);
  const excluded = copyRecords.length - selected.length;
  let state = "empty";
  let message = "扫描后显示当前勾选类型的预计复制量。";

  if (currentRecords.length && selected.length) {
    state = excluded ? "partial" : "ready";
    message = `当前会复制 ${formatNumber(selected.length)} 个开放素材，约 ${formatBytes(selectedSize)}`;
    if (excluded) message += `；已排除 ${formatNumber(excluded)} 个未勾选类型。`;
    else message += "。";
  } else if (currentRecords.length) {
    state = "blocked";
    message = "当前勾选类型里没有可复制素材，可以重新勾选或检查分类规则。";
  }

  categorySelectionSummary.dataset.state = state;
  categorySelectionSummary.textContent = message;
}

function getAuthorizedPlugins() {
  return window.GalAssetBoxPluginHost?.getPlugins?.() || [];
}

function describeAuthorizedPlugins() {
  return window.GalAssetBoxPluginHost?.describePlugins?.() || [];
}

function setAuthorizedPluginEnabled(id, enabled) {
  return window.GalAssetBoxPluginHost?.setPluginEnabled?.(id, enabled);
}

function getAuthorizedPluginIds() {
  return new Set(describeAuthorizedPlugins().map((plugin) => plugin.id));
}

function getAuthorizedPluginMatches(records) {
  const plugins = getAuthorizedPlugins().filter((plugin) => plugin.enabled && typeof plugin.match === "function");
  const matches = [];
  for (const record of records) {
    for (const plugin of plugins) {
      try {
        const result = plugin.match({
          path: record.path,
          name: record.name,
          ext: record.ext,
          size: record.size,
          categoryId: record.category.id,
          action: record.action,
        });
        if (result) {
          matches.push({
            pluginId: plugin.id,
            pluginName: plugin.name,
            canTransform: typeof plugin.transform === "function",
            plugin,
            record,
            result,
          });
        }
      } catch (error) {
        currentLog.push(`插件匹配失败：${plugin.id} - ${error.message}`);
      }
    }
  }
  return matches;
}

function getTransformPluginMatches(records) {
  return getAuthorizedPluginMatches(records).filter(
    (match) => match.canTransform && (match.record.handle || match.record.desktopSourcePath),
  );
}

function renderCategoryOptions() {
  const savedCategoryIds = loadCategorySelection();
  categoryOptions.innerHTML = CATEGORY_DEFS.map(
    (category) => `
      <label class="category-toggle" data-category-option="${escapeHtml(category.id)}" data-empty="true">
        <input type="checkbox" value="${category.id}" ${savedCategoryIds.has(category.id) ? "checked" : ""} />
        <span class="category-label">${escapeHtml(category.label)}</span>
        <span class="category-meta">
          <strong data-category-count="${escapeHtml(category.id)}">0</strong>
          <em data-category-size="${escapeHtml(category.id)}">0 B</em>
        </span>
      </label>
    `,
  ).join("");
  categoryOptions.addEventListener("change", () => {
    saveCategorySelection();
    updateActionState();
    render();
  });
  updateCategoryOptionMetrics();
  updateCategoryPresetState();
  updateCategorySelectionSummary();
}

async function pickSource() {
  if (desktopBridge) {
    const picked = await desktopBridge.pickDirectory("source");
    if (!picked || picked.canceled) return;
    desktopSource = picked;
    sourceHandle = null;
    sourceName.textContent = picked.name;
    projectTitle.textContent = picked.name;
    currentRecords = [];
    lastOrganizeRun = null;
    lastPluginRun = null;
    currentLog = [`已选择桌面源目录：${picked.name}`];
    setProgress("已选择游戏文件夹", "点击扫描素材查看可整理内容。", 10, "neutral");
    updateActionState();
    render();
    return;
  }
  if (!("showDirectoryPicker" in window)) {
    showToast("当前浏览器不支持直接写入文件夹，请用 Chrome / Edge 或先生成清单。");
    return;
  }
  sourceHandle = await window.showDirectoryPicker({ mode: "read" });
  desktopSource = null;
  sourceName.textContent = sourceHandle.name;
  projectTitle.textContent = sourceHandle.name;
  currentRecords = [];
  lastOrganizeRun = null;
  lastPluginRun = null;
  currentLog = [`已选择源目录：${sourceHandle.name}`];
  setProgress("已选择游戏文件夹", "点击扫描素材查看可整理内容。", 10, "neutral");
  updateActionState();
  render();
}

async function pickOutput() {
  if (desktopBridge) {
    const picked = await desktopBridge.pickDirectory("output");
    if (!picked || picked.canceled) return;
    desktopOutput = picked;
    outputHandle = null;
    outputName.textContent = picked.name;
    lastOrganizeRun = null;
    lastPluginRun = null;
    currentLog.push(`已选择桌面输出目录：${picked.name}`);
    updateActionState();
    render();
    return;
  }
  if (!("showDirectoryPicker" in window)) {
    showToast("当前浏览器不支持直接写入文件夹。");
    return;
  }
  outputHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  desktopOutput = null;
  outputName.textContent = outputHandle.name;
  lastOrganizeRun = null;
  lastPluginRun = null;
  currentLog.push(`已选择输出目录：${outputHandle.name}`);
  updateActionState();
  render();
}

async function scanSourceDirectory() {
  if (!sourceHandle && !desktopSource) return;
  setBusy(true);
  currentRecords = [];
  lastOrganizeRun = null;
  lastPluginRun = null;
  currentLog = [`开始扫描：${sourceHandle?.name || desktopSource?.name}`];
  setStatus("Scanning", "scanning");
  setProgress("扫描中", "正在读取文件名和大小。", 5, "active");

  try {
    const records = [];
    if (desktopSource) {
      const scanned = await desktopBridge.scanDirectory(desktopSource.path);
      for (const file of scanned.files || []) {
        records.push(makeRecord({
          path: file.path,
          size: file.size,
          handle: null,
          desktopSourcePath: file.absolutePath,
        }));
      }
      setProgress("扫描中", `已发现 ${formatNumber(records.length)} 个文件`, 88, "active");
    } else {
      await walkDirectory(sourceHandle, "", async (fileHandle, relativePath, scanned) => {
        const file = await fileHandle.getFile();
        records.push(makeRecord({ path: relativePath, size: file.size, handle: fileHandle }));
        if (scanned % 100 === 0) {
          setProgress("扫描中", `已发现 ${formatNumber(scanned)} 个文件`, Math.min(86, scanned / 20), "active");
          await pause();
        }
      });
    }
    currentRecords = records;
    currentLog.push(`扫描完成：${formatNumber(records.length)} 个文件。`);
    setProgress("扫描完成", summarizeRecords(records), 100, "success");
    setStatus("Scanned", "ready");
  } catch (error) {
    currentLog.push(`扫描失败：${error.message}`);
    setProgress("扫描失败", error.message, 100, "danger");
    setStatus("Error", "blocked");
  } finally {
    setBusy(false);
    render();
  }
}

async function walkDirectory(directoryHandle, prefix, onFile) {
  let scanned = 0;
  const visit = async (handle, currentPrefix) => {
    for await (const [name, child] of handle.entries()) {
      const lowerName = name.toLowerCase();
      if (child.kind === "directory") {
        if (SKIPPED_DIRS.has(lowerName) || lowerName.startsWith("galassetbox_整理结果")) continue;
        await visit(child, `${currentPrefix}${name}/`);
      } else if (child.kind === "file") {
        scanned += 1;
        await onFile(child, `${currentPrefix}${name}`, scanned);
      }
    }
  };
  await visit(directoryHandle, prefix);
}

async function organizeAssets() {
  if ((!sourceHandle && !desktopSource) || (!outputHandle && !desktopOutput)) return;
  if (!currentRecords.length) await scanSourceDirectory();
  if (!currentRecords.length) return;

  const selected = getSelectedCopyRecords();
  if (!selected.length) {
    showToast("没有可复制的开放素材");
    return;
  }

  const totalSize = selected.reduce((sum, record) => sum + record.size, 0);
  const archiveTotal = currentRecords.filter((record) => record.category.id === "archive").length;
  const ok = window.confirm(
    [
      `将复制 ${formatNumber(selected.length)} 个开放素材，约 ${formatBytes(totalSize)}。`,
      `输出目录：${outputHandle?.name || desktopOutput?.name}`,
      archiveTotal ? `发现 ${formatNumber(archiveTotal)} 个资源封包，只写入清单，不拆包。` : "未发现需要提示的资源封包。",
      "确认开始整理？",
    ].join("\n"),
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Copying", "scanning");
  setProgress("整理中", "正在复制开放素材。", 0, "active");
  currentLog.push(`开始复制开放素材：${formatNumber(selected.length)} 个。`);
  lastOrganizeRun = null;

  const resultRootName = `GalAssetBox_整理结果_${nowStamp()}`;
  let resultRoot = null;
  let desktopResultPath = "";
  let copied = 0;
  let failed = 0;

  try {
    if (desktopSource && desktopOutput) {
      const result = await desktopBridge.organizeAssets({
        sourceRootPath: desktopSource.path,
        outputRootPath: desktopOutput.path,
        resultRootName,
        records: selected.map((record) => ({
          relativePath: record.path,
          categoryFolder: record.category.folder,
        })),
        reports: {
          markdown: buildMarkdownReport(selected, resultRootName),
          csv: buildCsvReport(currentRecords),
        },
      });
      copied = result.copied || 0;
      failed = result.failed || 0;
      desktopResultPath = result.resultPath || joinDesktopPath(desktopOutput.path, resultRootName);
      for (const row of result.rows || []) {
        if (row.status === "failed") currentLog.push(`复制失败：${row.relativePath} - ${row.message}`);
      }
    } else {
      resultRoot = await outputHandle.getDirectoryHandle(resultRootName, { create: true });
      for (const record of selected) {
        try {
          await copyRecord(record, resultRoot);
          copied += 1;
        } catch (error) {
          failed += 1;
          currentLog.push(`复制失败：${record.path} - ${error.message}`);
        }

        if ((copied + failed) % 10 === 0 || copied + failed === selected.length) {
          const done = copied + failed;
          setProgress(
            "整理中",
            `${formatNumber(done)} / ${formatNumber(selected.length)}，已复制 ${formatNumber(copied)} 个`,
            (done / selected.length) * 92,
            "active",
          );
          await pause();
        }
      }
      await writeReports(resultRoot, selected, resultRootName);
    }

    currentLog.push(`整理完成：成功 ${formatNumber(copied)} 个，失败 ${formatNumber(failed)} 个。`);
    currentLog.push(`结果文件夹：${resultRootName}`);
    lastOrganizeRun = {
      resultRootName,
      reportPath: `${resultRootName}/GalAssetBox_整理报告.md`,
      csvPath: `${resultRootName}/GalAssetBox_素材清单.csv`,
      copied,
      failed,
      totalSelected: selected.length,
      totalSize,
      archiveTotal,
      outputFolderName: outputHandle?.name || desktopOutput?.name || "",
      desktopResultPath,
      finishedAt: new Date().toISOString(),
    };
    setProgress("整理完成", `结果已写入 ${resultRootName}`, 100, failed ? "warn" : "success");
    setStatus(failed ? "Partial" : "Done", failed ? "warn" : "ready");
    showToast("整理完成");
  } catch (error) {
    currentLog.push(`整理失败：${error.message}`);
    setProgress("整理失败", error.message, 100, "danger");
    setStatus("Error", "blocked");
  } finally {
    setBusy(false);
    render();
  }
}

async function runAuthorizedPlugins() {
  if ((!sourceHandle && !desktopSource) || (!outputHandle && !desktopOutput)) return;
  if (!currentRecords.length) await scanSourceDirectory();
  if (!currentRecords.length) return;

  const matches = getTransformPluginMatches(currentRecords);
  if (!matches.length) {
    showToast("没有可运行的授权插件匹配项");
    return;
  }

  const ok = window.confirm(
    [
      `将运行 ${formatNumber(matches.length)} 个授权插件匹配项。`,
      `输出目录：${outputHandle?.name || desktopOutput?.name}`,
      "仅适用于你自己拥有授权的项目格式；不会运行 DRM 绕过或第三方密钥规则。",
      "确认运行？",
    ].join("\n"),
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Plugins", "scanning");
  setProgress("授权插件运行中", "正在处理已确认的插件匹配项。", 0, "active");
  currentLog.push(`开始运行授权插件：${formatNumber(matches.length)} 个匹配项。`);
  lastPluginRun = null;

  const resultRootName = `GalAssetBox_授权插件结果_${nowStamp()}`;
  const runRows = [];
  let written = 0;
  let failed = 0;

  try {
    const resultRoot = outputHandle
      ? await outputHandle.getDirectoryHandle(resultRootName, { create: true })
      : null;
    const pluginOutputRoot = resultRoot
      ? await resultRoot.getDirectoryHandle("10_授权插件输出", { create: true })
      : null;

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      try {
        const outputs = await executeAuthorizedPlugin(match);
        for (const output of outputs) {
          const targetPath = desktopOutput
            ? await writePluginOutputDesktop(desktopOutput.path, resultRootName, match, output)
            : await writePluginOutput(pluginOutputRoot, match, output);
          written += 1;
          runRows.push({
            pluginId: match.pluginId,
            sourcePath: match.record.path,
            outputPath: targetPath,
            status: "written",
            message: "",
          });
        }
        if (!outputs.length) {
          runRows.push({
            pluginId: match.pluginId,
            sourcePath: match.record.path,
            outputPath: "",
            status: "empty",
            message: "插件没有输出文件。",
          });
        }
      } catch (error) {
        failed += 1;
        currentLog.push(`授权插件失败：${match.pluginId} / ${match.record.path} - ${error.message}`);
        runRows.push({
          pluginId: match.pluginId,
          sourcePath: match.record.path,
          outputPath: "",
          status: "failed",
          message: error.message,
        });
      }

      setProgress(
        "授权插件运行中",
        `${formatNumber(index + 1)} / ${formatNumber(matches.length)}，已写入 ${formatNumber(written)} 个文件`,
        ((index + 1) / matches.length) * 92,
        "active",
      );
      await pause();
    }

    let desktopResultPath = "";
    if (desktopOutput) {
      const reportResult = await desktopBridge.writePluginRunReports({
        outputRootPath: desktopOutput.path,
        resultRootName,
        markdown: buildPluginRunMarkdown(resultRootName, runRows),
        csv: buildPluginRunCsv(runRows),
      });
      desktopResultPath = reportResult.resultPath || joinDesktopPath(desktopOutput.path, resultRootName);
    } else {
      await writePluginRunReports(resultRoot, resultRootName, runRows);
    }
    lastPluginRun = {
      resultRootName,
      outputRootPath: `${resultRootName}/10_授权插件输出`,
      reportPath: `${resultRootName}/GalAssetBox_授权插件报告.md`,
      csvPath: `${resultRootName}/GalAssetBox_授权插件清单.csv`,
      written,
      failed,
      totalMatches: matches.length,
      rows: runRows.slice(),
      finishedAt: new Date().toISOString(),
      outputFolderName: outputHandle?.name || desktopOutput?.name || "",
      desktopResultPath,
    };
    currentLog.push(`授权插件完成：写入 ${formatNumber(written)} 个文件，失败 ${formatNumber(failed)} 个匹配项。`);
    currentLog.push(`授权插件结果文件夹：${resultRootName}`);
    currentLog.push(`报告文件：${lastPluginRun.reportPath}`);
    currentLog.push(`清单文件：${lastPluginRun.csvPath}`);
    setProgress("授权插件完成", `结果已写入 ${resultRootName}`, 100, failed ? "warn" : "success");
    setStatus(failed ? "Partial" : "Done", failed ? "warn" : "ready");
    showToast("授权插件运行完成");
  } catch (error) {
    currentLog.push(`授权插件运行失败：${error.message}`);
    setProgress("授权插件失败", error.message, 100, "danger");
    setStatus("Error", "blocked");
  } finally {
    setBusy(false);
    render();
  }
}

async function importExternalPluginFile(file) {
  if (!file) return;
  if (!/\.js$/i.test(file.name) && !/\.gabplugin\.js$/i.test(file.name)) {
    showToast("请选择 .js 插件文件");
    return;
  }
  if (file.size > MAX_PLUGIN_FILE_BYTES) {
    showToast("插件文件超过 1 MB，已拒绝导入");
    return;
  }

  const ok = window.confirm(
    [
      `即将导入本地插件：${file.name}`,
      "插件是本地 JavaScript 代码，只导入你信任、来源清楚、用于授权项目的插件。",
      "导入后仍必须通过安全策略校验：本地运行、用户授权、不绕过 DRM、不内置第三方密钥。",
      "确认导入？",
    ].join("\n"),
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Importing", "scanning");
  setProgress("导入插件中", `正在读取 ${file.name}`, 30, "active");

  try {
    const source = await file.text();
    await importExternalPluginSource(source, {
      sourceInfo: {
        sourceType: "external-file",
        sourceName: file.name,
        sourceMain: file.name,
      },
      logLabel: `插件文件：${file.name}`,
      successLabel: file.name,
    });
  } catch (error) {
    currentLog.push(`导入插件失败：${file.name} - ${error.message}`);
    setProgress("导入失败", error.message, 100, "danger");
    setStatus("Error", "blocked");
  } finally {
    setBusy(false);
    render();
  }
}

async function importExternalPluginPackage(files) {
  const fileList = [...(files || [])];
  if (!fileList.length) return;
  const totalSize = fileList.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_PLUGIN_PACKAGE_BYTES) {
    showToast("插件包超过 2 MB，已拒绝导入");
    return;
  }

  const manifestFiles = fileList.filter((file) => getPackageRelativePath(file).toLowerCase().endsWith("/plugin.json") || getPackageRelativePath(file).toLowerCase() === "plugin.json");
  if (manifestFiles.length !== 1) {
    showToast("插件包需要且只能包含一个 plugin.json");
    return;
  }

  setBusy(true);
  setStatus("Importing", "scanning");
  setProgress("导入插件包中", "正在读取 plugin.json", 20, "active");

  try {
    const manifestFile = manifestFiles[0];
    const manifestPath = getPackageRelativePath(manifestFile);
    const packageRoot = manifestPath.split("/").slice(0, -1).join("/");
    const manifest = JSON.parse(await manifestFile.text());
    validatePluginPackageManifest(manifest);

    const mainPath = resolvePackagePath(packageRoot, manifest.main);
    const mainFile = fileList.find((file) => getPackageRelativePath(file) === mainPath);
    if (!mainFile) throw new Error(`插件包找不到 main 文件：${manifest.main}`);
    if (!/\.js$/i.test(mainFile.name) && !/\.gabplugin\.js$/i.test(mainFile.name)) {
      throw new Error("插件包 main 必须是 .js 或 .gabplugin.js 文件。");
    }
    if (mainFile.size > MAX_PLUGIN_FILE_BYTES) {
      throw new Error("插件包 main 文件超过 1 MB。");
    }

    const ok = window.confirm(
      [
        `即将导入插件包：${manifest.name}`,
        manifest.description || "没有描述。",
        `入口文件：${manifest.main}`,
        "插件包仍然是本地 JavaScript 代码，只导入可信、授权用途明确的插件包。",
        "确认导入？",
      ].join("\n"),
    );
    if (!ok) {
      setProgress("已取消导入插件包", manifest.name, 100, "neutral");
      setStatus("Ready", "neutral");
      return;
    }

    setProgress("导入插件包中", `正在加载 ${manifest.main}`, 52, "active");
    const source = await mainFile.text();
    await importExternalPluginSource(source, {
      sourceInfo: {
        sourceType: "package",
        sourceName: manifest.name,
        sourceMain: manifest.main,
        packageId: manifest.id || "",
        packageName: manifest.name,
        packageDescription: manifest.description || "",
        version: manifest.version || "",
        author: manifest.author || "",
        license: manifest.license || "",
      },
      logLabel: `插件包：${manifest.name}`,
      successLabel: manifest.name,
    });
  } catch (error) {
    currentLog.push(`导入插件包失败：${error.message}`);
    setProgress("导入插件包失败", error.message, 100, "danger");
    setStatus("Error", "blocked");
  } finally {
    setBusy(false);
    render();
  }
}

async function importExternalPluginSource(source, { sourceInfo, logLabel, successLabel }) {
  const beforeIds = getAuthorizedPluginIds();
  const host = window.GalAssetBoxPluginHost;
  if (!host?.beginExternalPluginImport || !host?.endExternalPluginImport) {
    throw new Error("插件宿主不可用。");
  }
  host.beginExternalPluginImport(sourceInfo);
  try {
    const execute = new Function(
      "window",
      "GalAssetBoxPluginHost",
      `"use strict";\n${source}\n//# sourceURL=${encodeURIComponent(sourceInfo.sourceName || "external-plugin")}`,
    );
    execute(window, host);
  } finally {
    host.endExternalPluginImport();
  }

  const imported = describeAuthorizedPlugins().filter((plugin) => !beforeIds.has(plugin.id));
  if (!imported.length) {
    throw new Error("插件没有注册任何新插件。");
  }

  currentLog.push(`已导入${logLabel}`);
  for (const plugin of imported) currentLog.push(`新插件：${plugin.id}`);
  setProgress("插件已导入", `${successLabel} 注册了 ${formatNumber(imported.length)} 个插件。`, 100, "success");
  setStatus("Imported", "ready");
  showToast(`已导入 ${imported.length} 个插件`);
}

function getPackageRelativePath(file) {
  return normalizePath(file.webkitRelativePath || file.name);
}

function validatePluginPackageManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("plugin.json 格式无效。");
  if (manifest.format !== "GalAssetBox.pluginPackage.v1") {
    throw new Error("plugin.json format 必须是 GalAssetBox.pluginPackage.v1。");
  }
  for (const key of ["name", "main"]) {
    if (!manifest[key] || typeof manifest[key] !== "string") {
      throw new Error(`plugin.json 缺少 ${key}。`);
    }
  }
  if (manifest.id && !/^[a-z0-9][a-z0-9._-]*$/i.test(manifest.id)) {
    throw new Error("plugin.json id 格式无效。");
  }
  const safety = manifest.safety || {};
  for (const flag of PLUGIN_PACKAGE_SAFETY_FLAGS) {
    if (safety[flag] !== true) {
      throw new Error(`plugin.json safety.${flag} 必须是 true。`);
    }
  }
}

function resolvePackagePath(packageRoot, relativePath) {
  const normalized = normalizePath(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("plugin.json main 路径不安全。");
  }
  return [packageRoot, ...parts].filter(Boolean).join("/");
}

async function executeAuthorizedPlugin(match) {
  const sourceFile = match.record.handle
    ? await match.record.handle.getFile()
    : {
        name: match.record.name,
        size: match.record.size,
        text: () => desktopBridge.readFileText(match.record.desktopSourcePath),
        arrayBuffer: () => desktopBridge.readFileArrayBuffer(match.record.desktopSourcePath),
      };
  const outputs = await match.plugin.transform({
    record: {
      path: match.record.path,
      name: match.record.name,
      ext: match.record.ext,
      size: match.record.size,
      categoryId: match.record.category.id,
      action: match.record.action,
    },
    match: {
      confidence: match.result.confidence || "",
      label: match.result.label || "",
      note: match.result.note || "",
    },
    file: sourceFile,
    readText: () => sourceFile.text(),
    readArrayBuffer: () => sourceFile.arrayBuffer(),
  });
  return normalizePluginOutputs(outputs);
}

function normalizePluginOutputs(outputs) {
  if (!Array.isArray(outputs)) throw new Error("插件输出必须是数组。");
  if (outputs.length > 500) throw new Error("单个插件匹配项最多输出 500 个文件。");
  return outputs.map((output, index) => {
    if (!output || typeof output !== "object") throw new Error(`输出 ${index} 不是对象。`);
    return {
      path: normalizePluginOutputPath(output.path, index),
      text: typeof output.text === "string" ? output.text : null,
      blob: output.blob instanceof Blob ? output.blob : null,
      arrayBuffer: output.arrayBuffer instanceof ArrayBuffer ? output.arrayBuffer : null,
      bytes: output.bytes instanceof Uint8Array ? output.bytes : null,
      type: typeof output.type === "string" ? output.type : "application/octet-stream",
    };
  });
}

function normalizePluginOutputPath(path, index) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) throw new Error(`输出 ${index} 缺少 path。`);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error(`输出 ${index} 包含不安全路径。`);
  }
  return parts.map(safeSegment).join("/");
}

async function writePluginOutput(pluginOutputRoot, match, output) {
  const blob = pluginOutputToBlob(output);
  const pluginRoot = await pluginOutputRoot.getDirectoryHandle(safeSegment(match.pluginId), { create: true });
  const safeSourceParts = match.record.path.split("/").filter(Boolean).map(safeSegment);
  const sourceRoot = await ensureDirectory(
    pluginRoot,
    ["from", ...safeSourceParts],
  );
  const targetParts = output.path.split("/").filter(Boolean);
  const fileName = targetParts.pop();
  const targetDir = await ensureDirectory(sourceRoot, targetParts);
  const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return `10_授权插件输出/${match.pluginId}/from/${safeSourceParts.join("/")}/${[...targetParts, fileName].join("/")}`;
}

async function writePluginOutputDesktop(outputRootPath, resultRootName, match, output) {
  const serialized = await serializePluginOutput(output);
  return desktopBridge.writePluginOutput({
    outputRootPath,
    resultRootName,
    pluginId: match.pluginId,
    sourcePath: match.record.path,
    output: serialized,
  });
}

async function serializePluginOutput(output) {
  const blob = pluginOutputToBlob(output);
  const buffer = await blob.arrayBuffer();
  return {
    path: output.path,
    base64: arrayBufferToBase64(buffer),
    type: output.type,
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function pluginOutputToBlob(output) {
  if (output.blob) {
    return output.blob;
  }
  if (output.text !== null) {
    return new Blob([output.text], { type: output.type });
  }
  if (output.arrayBuffer) {
    return new Blob([output.arrayBuffer], { type: output.type });
  }
  if (output.bytes) {
    return new Blob([output.bytes], { type: output.type });
  }
  throw new Error(`插件输出 ${output.path} 没有内容。`);
}

async function writePluginRunReports(resultRoot, resultRootName, runRows) {
  await writeTextFile(
    resultRoot,
    "GalAssetBox_授权插件报告.md",
    buildPluginRunMarkdown(resultRootName, runRows),
    "text/markdown;charset=utf-8",
  );
  await writeTextFile(
    resultRoot,
    "GalAssetBox_授权插件清单.csv",
    buildPluginRunCsv(runRows),
    "text/csv;charset=utf-8",
  );
}

function buildPluginRunMarkdown(resultRootName, runRows) {
  const lines = [];
  const written = runRows.filter((row) => row.status === "written").length;
  const failed = runRows.filter((row) => row.status === "failed").length;
  lines.push("# GalAssetBox 授权插件报告");
  lines.push("");
  lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push(`- 源目录：${sourceHandle?.name || "unknown"}`);
  lines.push(`- 结果目录：${resultRootName}`);
  lines.push(`- 写入文件：${formatNumber(written)} 个`);
  lines.push(`- 失败匹配项：${formatNumber(failed)} 个`);
  lines.push("");
  lines.push("## 安全边界");
  lines.push("- 本次只运行已启用且显式声明安全策略的本地插件。");
  lines.push("- 插件运行前需要用户确认。");
  lines.push("- 插件不得内置第三方游戏密钥、破解规则或 DRM / 授权绕过逻辑。");
  lines.push("");
  lines.push("## 输出");
  for (const row of runRows.slice(0, 200)) {
    lines.push(`- [${row.status}] ${row.pluginId} | ${row.sourcePath}${row.outputPath ? ` -> ${row.outputPath}` : ""}${row.message ? ` | ${row.message}` : ""}`);
  }
  if (runRows.length > 200) lines.push(`- 其余 ${formatNumber(runRows.length - 200)} 行见 CSV 清单`);
  return lines.join("\n");
}

function buildPluginRunCsv(runRows) {
  const header = ["plugin_id", "source_path", "output_path", "status", "message"];
  const rows = runRows.map((row) => [row.pluginId, row.sourcePath, row.outputPath, row.status, row.message]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildDiagnosticPackage() {
  const plugins = describeAuthorizedPlugins();
  const matches = currentRecords.length ? getAuthorizedPluginMatches(currentRecords) : [];
  const categoryCounts = CATEGORY_DEFS.map((definition) => {
    const records = currentRecords.filter((record) => record.category.id === definition.id);
    return {
      id: definition.id,
      label: definition.label,
      count: records.length,
      size: records.reduce((sum, record) => sum + record.size, 0),
    };
  });
  const archiveRecords = currentRecords.filter((record) => record.category.id === "archive");
  const ignoredRecords = currentRecords.filter((record) => record.category.id === "ignored");

  return {
    format: "GalAssetBox.diagnostic.v1",
    createdAt: new Date().toISOString(),
    app: {
      name: "GalAssetBox",
      pluginApiVersion: window.GalAssetBoxPluginHost?.apiVersion || "unavailable",
    },
    privacy: {
      containsFileContents: false,
      containsAbsolutePaths: false,
      pathType: "browser relative paths only",
      note: "This diagnostic package contains metadata, logs, plugin state, and relative file manifest entries only.",
    },
    workspace: {
      sourceName: sourceHandle?.name || sourceName.textContent || "",
      outputName: outputHandle?.name || outputName.textContent || "",
      hasSourceHandle: Boolean(sourceHandle),
      hasOutputHandle: Boolean(outputHandle),
    },
    scan: {
      totalFiles: currentRecords.length,
      totalSize: currentRecords.reduce((sum, record) => sum + record.size, 0),
      categoryCounts,
      archives: archiveRecords.length,
      ignored: ignoredRecords.length,
      selectedCategoryIds: [...selectedCategoryIds()],
      customCategoryRules: customCategoryRules.map((rule) => ({
        keyword: rule.keyword,
        categoryId: rule.categoryId,
        categoryLabel: CATEGORY_BY_ID.get(rule.categoryId)?.label || rule.categoryId,
      })),
    },
    plugins: plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      author: plugin.author,
      license: plugin.license,
      enabled: plugin.enabled,
      defaultEnabled: plugin.defaultEnabled,
      canTransform: plugin.canTransform,
      capabilities: plugin.capabilities,
      source: plugin.source,
      sourceName: plugin.sourceName,
      sourceMain: plugin.sourceMain,
      packageId: plugin.packageId,
      packageName: plugin.packageName,
      importedAt: plugin.importedAt,
      policy: plugin.policy,
    })),
    matches: matches.map((match) => ({
      pluginId: match.pluginId,
      pluginName: match.pluginName,
      canTransform: match.canTransform,
      confidence: match.result.confidence || "",
      label: match.result.label || "",
      note: match.result.note || "",
      record: recordForDiagnostic(match.record),
    })),
    manifest: currentRecords.map(recordForDiagnostic),
    lastOrganizeRun: lastOrganizeRun
      ? {
          resultRootName: lastOrganizeRun.resultRootName,
          reportPath: lastOrganizeRun.reportPath,
          csvPath: lastOrganizeRun.csvPath,
          copied: lastOrganizeRun.copied,
          failed: lastOrganizeRun.failed,
          totalSelected: lastOrganizeRun.totalSelected,
          totalSize: lastOrganizeRun.totalSize,
          archiveTotal: lastOrganizeRun.archiveTotal,
          outputFolderName: lastOrganizeRun.outputFolderName,
          finishedAt: lastOrganizeRun.finishedAt,
        }
      : null,
    lastPluginRun: lastPluginRun
      ? {
          resultRootName: lastPluginRun.resultRootName,
          outputRootPath: lastPluginRun.outputRootPath,
          reportPath: lastPluginRun.reportPath,
          csvPath: lastPluginRun.csvPath,
          written: lastPluginRun.written,
          failed: lastPluginRun.failed,
          totalMatches: lastPluginRun.totalMatches,
          finishedAt: lastPluginRun.finishedAt,
          rows: lastPluginRun.rows,
        }
      : null,
    log: currentLog.slice(-500),
  };
}

function recordForDiagnostic(record) {
  return {
    path: record.path,
    name: record.name,
    ext: record.ext,
    size: record.size,
    categoryId: record.category.id,
    categoryLabel: record.category.label,
    action: record.action,
  };
}

function downloadDiagnosticPackage() {
  const diagnostic = buildDiagnosticPackage();
  const text = JSON.stringify(diagnostic, null, 2);
  downloadText(`GalAssetBox_诊断包_${formatDateTimeCompact()}.json`, text, "application/json;charset=utf-8");
  currentLog.push("已导出诊断包：仅包含元数据、相对路径、插件状态和日志。");
  showToast("诊断包已导出");
  render();
}

function buildHelpSummaryMarkdown() {
  const selected = getSelectedCopyRecords();
  const archives = currentRecords.filter((record) => record.category.id === "archive");
  const ignored = currentRecords.filter((record) => record.category.id === "ignored");
  const plugins = describeAuthorizedPlugins();
  const matches = currentRecords.length ? getAuthorizedPluginMatches(currentRecords) : [];
  const runnableMatches = getTransformPluginMatches(currentRecords);
  const selectedIds = selectedCategoryIds();
  const totalSize = currentRecords.reduce((sum, record) => sum + record.size, 0);
  const selectedSize = selected.reduce((sum, record) => sum + record.size, 0);
  const categoryRows = CATEGORY_DEFS.map((definition) => {
    const records = currentRecords.filter((record) => record.category.id === definition.id);
    return [definition.label, records.length, records.reduce((sum, record) => sum + record.size, 0)];
  });
  const archiveExtCounts = [...countBy(archives, (record) => record.ext || "(no ext)").entries()]
    .map(([ext, count]) => {
      const size = archives.filter((record) => (record.ext || "(no ext)") === ext).reduce((sum, record) => sum + record.size, 0);
      return { ext, count, size };
    })
    .sort((a, b) => b.count - a.count || b.size - a.size);
  const logHighlights = currentLog
    .filter((line) => /失败|错误|拒绝|取消|封包|未找到|不能|Error|failed/i.test(line))
    .slice(-20)
    .map(sanitizeHelpText);
  const lines = [];

  lines.push("# GalAssetBox 求助摘要");
  lines.push("");
  lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push(`- 运行环境：${desktopBridge ? "桌面版 Electron" : "浏览器版"}`);
  lines.push("- 隐私说明：本摘要不包含素材内容、绝对本机路径、密钥或授权材料。");
  lines.push("- 边界说明：封包只记录清单，不拆包、不解密、不绕过 DRM。");
  lines.push("");
  lines.push("## 扫描概况");
  lines.push(`- 扫描文件：${formatNumber(currentRecords.length)} 个，合计 ${formatBytes(totalSize)}`);
  lines.push(`- 准备复制：${formatNumber(selected.length)} 个开放素材，约 ${formatBytes(selectedSize)}`);
  lines.push(`- 封包提示：${formatNumber(archives.length)} 个`);
  lines.push(`- 未整理文件：${formatNumber(ignored.length)} 个`);
  lines.push(`- 已选择输出：${outputHandle || desktopOutput ? "是" : "否"}`);
  lines.push("");
  lines.push("## 分类统计");
  for (const [label, count, size] of categoryRows) {
    lines.push(`- ${label}: ${formatNumber(count)} 个，${formatBytes(size)}`);
  }
  lines.push("");
  lines.push("## 封包类型");
  if (archiveExtCounts.length) {
    for (const item of archiveExtCounts.slice(0, 12)) {
      lines.push(`- .${item.ext}: ${formatNumber(item.count)} 个，${formatBytes(item.size)}`);
    }
  } else {
    lines.push("- 未发现常见资源封包。");
  }
  lines.push("");
  lines.push("## 分类规则");
  if (customCategoryRules.length) {
    for (const rule of customCategoryRules) {
      lines.push(`- 包含 "${rule.keyword}" -> ${CATEGORY_BY_ID.get(rule.categoryId)?.label || rule.categoryId}`);
    }
  } else {
    lines.push("- 未添加自定义分类规则。");
  }
  lines.push("");
  lines.push("## 已勾选类型");
  lines.push(
    CATEGORY_DEFS
      .filter((definition) => selectedIds.has(definition.id))
      .map((definition) => definition.label)
      .join("、") || "无",
  );
  lines.push("");
  lines.push("## 插件状态");
  lines.push(`- 已安装插件：${formatNumber(plugins.length)} 个`);
  lines.push(`- 当前匹配：${formatNumber(matches.length)} 个`);
  lines.push(`- 可执行匹配：${formatNumber(runnableMatches.length)} 个`);
  for (const plugin of plugins.slice(0, 12)) {
    lines.push(`- ${plugin.enabled ? "启用" : "停用"} | ${plugin.name} | ${formatPluginSource(plugin.source)} | ${plugin.canTransform ? "可执行" : "只识别"}`);
  }
  lines.push("");
  lines.push("## 最近整理");
  if (lastOrganizeRun) {
    lines.push(`- 结果目录：${lastOrganizeRun.resultRootName}`);
    lines.push(`- 成功复制：${formatNumber(lastOrganizeRun.copied)} 个`);
    lines.push(`- 失败：${formatNumber(lastOrganizeRun.failed)} 个`);
  } else {
    lines.push("- 尚未完成整理。");
  }
  lines.push("");
  lines.push("## 最近插件运行");
  if (lastPluginRun) {
    lines.push(`- 结果目录：${lastPluginRun.resultRootName}`);
    lines.push(`- 写入文件：${formatNumber(lastPluginRun.written)} 个`);
    lines.push(`- 失败匹配项：${formatNumber(lastPluginRun.failed)} 个`);
  } else {
    lines.push("- 尚未运行授权插件。");
  }
  lines.push("");
  lines.push("## 需要别人帮忙看时可以先说");
  if (!selected.length && archives.length) {
    lines.push("- 这个文件夹主要像是封包资源，当前版本只做提示和清单，不会拆包。");
  } else if (!selected.length) {
    lines.push("- 没有识别到可复制的开放素材，可能需要检查文件类型或分类规则。");
  } else if (archives.length) {
    lines.push("- 开放素材可以整理，但还有封包提示，封包不会被提取。");
  } else {
    lines.push("- 扫描结果里有开放素材，可以先按当前分类整理。");
  }
  if (!(outputHandle || desktopOutput)) lines.push("- 还没有选择输出文件夹。");
  lines.push("");
  lines.push("## 日志重点");
  if (logHighlights.length) {
    for (const line of logHighlights) lines.push(`- ${line}`);
  } else {
    lines.push("- 暂无明显错误或失败日志。");
  }
  return lines.join("\n");
}

function downloadHelpSummary() {
  if (!currentRecords.length) {
    showToast("请先扫描素材，再导出求助摘要");
    return;
  }
  downloadText(`GalAssetBox_求助摘要_${formatDateTimeCompact()}.md`, buildHelpSummaryMarkdown(), "text/markdown;charset=utf-8");
  currentLog.push("已导出求助摘要：不包含素材内容、绝对路径、密钥或授权材料。");
  showToast("求助摘要已导出");
  render();
}

function sanitizeHelpText(text) {
  return String(text || "")
    .replace(/[A-Za-z]:[\\/][^\s]+/g, "[local-path]")
    .replace(/\/Users\/[^\s]+/g, "[local-path]")
    .replace(/\/home\/[^\s]+/g, "[local-path]")
    .slice(0, 220);
}

function getSelectedCopyRecords() {
  const selectedIds = selectedCategoryIds();
  return currentRecords.filter((record) => record.category.copy && selectedIds.has(record.category.id));
}

async function copyRecord(record, resultRoot) {
  const categoryFolder = record.category.folder;
  const targetParts = [categoryFolder, ...record.path.split("/").filter(Boolean).map(safeSegment)];
  const fileName = targetParts.pop();
  const targetDir = await ensureDirectory(resultRoot, targetParts);
  const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const file = await record.handle.getFile();
  await writable.write(file);
  await writable.close();
}

async function ensureDirectory(rootHandle, parts) {
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

function safeSegment(value) {
  return String(value || "item")
    .replace(/[<>:"\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+$/g, "")
    .slice(0, 120) || "item";
}

async function writeReports(resultRoot, copiedRecords, resultRootName) {
  const markdown = buildMarkdownReport(copiedRecords, resultRootName);
  const csv = buildCsvReport(currentRecords);
  await writeTextFile(resultRoot, "GalAssetBox_整理报告.md", markdown, "text/markdown;charset=utf-8");
  await writeTextFile(resultRoot, "GalAssetBox_素材清单.csv", csv, "text/csv;charset=utf-8");
}

async function writeTextFile(directoryHandle, name, text, type) {
  const fileHandle = await directoryHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([text], { type }));
  await writable.close();
}

function buildMarkdownReport(copiedRecords, resultRootName) {
  const counts = countBy(currentRecords, (record) => record.category.id);
  const archiveRecords = currentRecords.filter((record) => record.category.id === "archive");
  const lines = [];
  lines.push("# GalAssetBox 整理报告");
  lines.push("");
  lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push(`- 源目录：${sourceHandle?.name || "manifest-only"}`);
  lines.push(`- 结果目录：${resultRootName}`);
  lines.push(`- 已复制开放素材：${formatNumber(copiedRecords.length)} 个`);
  lines.push(`- 已扫描文件：${formatNumber(currentRecords.length)} 个`);
  lines.push("");
  lines.push("## 分类统计");
  for (const definition of CATEGORY_DEFS) {
    lines.push(`- ${definition.label}: ${formatNumber(counts.get(definition.id) || 0)} 个`);
  }
  lines.push("");
  lines.push("## 封包提示");
  if (archiveRecords.length) {
    lines.push("以下文件只记录清单，没有拆包、解密或绕过 DRM：");
    for (const record of archiveRecords.slice(0, 40)) {
      lines.push(`- ${record.path} (${formatBytes(record.size)})`);
    }
    if (archiveRecords.length > 40) lines.push(`- 其余 ${formatNumber(archiveRecords.length - 40)} 个见 CSV 清单`);
  } else {
    lines.push("- 未发现常见资源封包。");
  }
  lines.push("");
  lines.push("## 边界说明");
  lines.push("- 只复制用户选择目录中已经明文存在的开放格式文件。");
  lines.push("- 不提供游戏本体、破解补丁、密钥、DRM 绕过或受保护封包解密。");
  lines.push("- 整理结果仅用于合法拥有或授权项目的个人备份、创作管理、翻译调试。");
  return lines.join("\n");
}

function buildCsvReport(records) {
  const header = ["category", "label", "action", "path", "extension", "size"];
  const rows = records.map((record) => [
    record.category.id,
    record.category.label,
    record.action,
    record.path,
    record.ext,
    String(record.size),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function countBy(items, getter) {
  return items.reduce((map, item) => {
    const key = getter(item);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function summarizeRecords(records) {
  const copyRecords = records.filter((record) => record.category.copy);
  const selectedIds = selectedCategoryIds();
  const selectedRecords = copyRecords.filter((record) => selectedIds.has(record.category.id));
  const archives = records.filter((record) => record.category.id === "archive");
  if (selectedRecords.length === copyRecords.length) {
    return `将整理 ${formatNumber(selectedRecords.length)} 个开放素材，${formatNumber(archives.length)} 个封包提示。`;
  }
  return `将整理 ${formatNumber(selectedRecords.length)} 个，开放素材共 ${formatNumber(copyRecords.length)} 个，${formatNumber(archives.length)} 个封包提示。`;
}

function render() {
  updateCategoryOptionMetrics();
  updateCategoryPresetState();
  updateCategorySelectionSummary();
  updateCompletedScanProgressSummary();
  if (!currentRecords.length) {
    renderEmpty();
    return;
  }

  const selected = getSelectedCopyRecords();
  const archives = currentRecords.filter((record) => record.category.id === "archive");
  const texts = currentRecords.filter((record) => record.category.id === "text");
  const totalSize = selected.reduce((sum, record) => sum + record.size, 0);

  selectedAssetCount.textContent = formatNumber(selected.length);
  copySize.textContent = formatBytes(totalSize);
  archiveCount.textContent = formatNumber(archives.length);
  textCount.textContent = formatNumber(texts.length);

  overviewPanel.innerHTML = renderOverview(selected, archives);
  categoriesPanel.innerHTML = renderCategories();
  archivesPanel.innerHTML = renderArchives(archives);
  authorizedPluginsPanel.innerHTML = renderAuthorizedPlugins();
  logPanel.innerHTML = renderLog();
}

function updateCompletedScanProgressSummary() {
  if (!currentRecords.length) return;
  const titles = new Set(["扫描完成", "样例已载入", "清单已生成"]);
  if (!titles.has(progressTitle.textContent.trim())) return;
  progressDetail.textContent = summarizeRecords(currentRecords);
}

function renderEmpty() {
  updateCategoryOptionMetrics();
  updateCategoryPresetState();
  updateCategorySelectionSummary();
  const empty = emptyTemplate.innerHTML;
  selectedAssetCount.textContent = "0";
  copySize.textContent = "0 B";
  archiveCount.textContent = "0";
  textCount.textContent = "0";
  overviewPanel.innerHTML = empty;
  categoriesPanel.innerHTML = empty;
  archivesPanel.innerHTML = empty;
  authorizedPluginsPanel.innerHTML = renderAuthorizedPlugins();
  logPanel.innerHTML = currentLog.length ? renderLog() : empty;
}

function renderOverview(selected, archives) {
  const disabledText = desktopBridge
    ? "桌面版可以通过本地桥直接整理到输出文件夹。"
    : "showDirectoryPicker" in window
      ? "可以直接整理到输出文件夹。"
    : "当前浏览器只能生成清单，请用 Chrome / Edge 开启直接整理。";
  return `
    <div class="section-title">
      <h3>整理预览</h3>
      <span>${escapeHtml(disabledText)}</span>
    </div>
    ${renderPreflightSummary(selected, archives)}
    <div class="result-action-row">
      <button id="downloadHelpSummaryInlineButton" type="button">导出求助摘要</button>
      <span>适合发给群友排查，不包含素材内容或绝对本机路径。</span>
    </div>
    <div class="card-list">
      <article class="summary-card">
        <h4>将复制的开放素材</h4>
        <p>${formatNumber(selected.length)} 个文件，约 ${formatBytes(selected.reduce((sum, record) => sum + record.size, 0))}</p>
      </article>
      <article class="summary-card">
        <h4>不会拆包的文件</h4>
        <p>${formatNumber(archives.length)} 个封包会写入清单，保留给用户确认来源和授权。</p>
      </article>
      <article class="summary-card">
        <h4>授权插件匹配</h4>
        <p>${formatNumber(getTransformPluginMatches(currentRecords).length)} 个匹配项可以在确认后运行，结果会写入独立插件输出目录。</p>
      </article>
    </div>
    ${renderOrganizeRunPreview(lastOrganizeRun)}
    <div class="section-title"><h3>样例路径</h3><span>最多显示 12 个</span></div>
    <div class="sample-list">${selected.slice(0, 12).map((record) => `<code>${escapeHtml(record.path)}</code>`).join("") || "<p>没有选中的开放素材。</p>"}</div>
  `;
}

function renderPreflightSummary(selected, archives) {
  const selectedIds = selectedCategoryIds();
  const missingEnabled = CATEGORY_DEFS
    .filter((definition) => selectedIds.has(definition.id))
    .filter((definition) => !currentRecords.some((record) => record.category.id === definition.id))
    .map((definition) => definition.label);
  const ignored = currentRecords.filter((record) => record.category.id === "ignored");
  const totalSize = selected.reduce((sum, record) => sum + record.size, 0);
  const hasOutput = Boolean(outputHandle || desktopOutput);
  const transformMatches = getTransformPluginMatches(currentRecords).length;
  const messages = [];
  let tone = "ready";
  let state = "可以整理";

  if (!selected.length) {
    tone = "blocked";
    state = "需要检查";
    messages.push("当前没有可复制的开放素材。可以检查左侧类型勾选，或看看文件是否主要在封包里。");
  } else {
    messages.push(`会复制 ${formatNumber(selected.length)} 个开放素材，预计占用 ${formatBytes(totalSize)}。`);
  }
  if (!hasOutput) {
    tone = tone === "blocked" ? "blocked" : "warn";
    state = tone === "blocked" ? state : "还差一步";
    messages.push("还没有选择输出文件夹，整理前需要先选一个位置。");
  }
  if (archives.length) {
    if (tone !== "blocked") tone = "warn";
    if (state === "可以整理") state = "有封包提示";
    messages.push(`发现 ${formatNumber(archives.length)} 个资源封包，只写入清单，不拆包、不解密。`);
  }
  if (missingEnabled.length) {
    messages.push(`已勾选但未找到：${missingEnabled.slice(0, 5).join("、")}${missingEnabled.length > 5 ? "等" : ""}。`);
  }
  if (transformMatches) {
    messages.push(`授权插件可处理 ${formatNumber(transformMatches)} 个匹配项，插件结果会写到独立目录。`);
  }
  if (ignored.length) {
    messages.push(`${formatNumber(ignored.length)} 个文件不是当前开放素材类型，会保留在清单里。`);
  }

  return `
    <article class="preflight-card ${tone}">
      <div class="preflight-top">
        <div>
          <h4>整理前预检</h4>
          <p>${tone === "ready" ? "扫描结果看起来正常，可以继续整理。" : "先看一眼提示，避免误会成软件坏了。"}</p>
        </div>
        <span class="preflight-state">${escapeHtml(state)}</span>
      </div>
      <div class="preflight-grid">
        <span><strong>${formatNumber(selected.length)}</strong>将整理</span>
        <span><strong>${formatBytes(totalSize)}</strong>预计复制</span>
        <span><strong>${formatNumber(archives.length)}</strong>封包提示</span>
        <span><strong>${formatNumber(missingEnabled.length)}</strong>空分类</span>
      </div>
      <ul class="preflight-list">
        ${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderOrganizeRunPreview(run) {
  if (!run) return "";
  return `
    <article class="result-card">
      <div>
        <h4>最近整理结果</h4>
        <p>${escapeHtml(run.resultRootName)} 已写入你选择的输出文件夹：${escapeHtml(run.outputFolderName)}。</p>
      </div>
      <div class="output-summary-grid">
        <span>复制 ${formatNumber(run.copied)} 个文件</span>
        <span>失败 ${formatNumber(run.failed)} 个</span>
        <span>封包提示 ${formatNumber(run.archiveTotal)} 个</span>
      </div>
      <div class="output-paths">
        <code>${escapeHtml(run.reportPath)}</code>
        <code>${escapeHtml(run.csvPath)}</code>
      </div>
      <div class="result-action-row">
        ${
          run.desktopResultPath
            ? `<button type="button" data-open-desktop-path="${escapeHtml(run.desktopResultPath)}">打开结果文件夹</button>`
            : "<span>网页版不能直接打开系统文件夹，请到输出文件夹里查看结果目录。</span>"
        }
      </div>
    </article>
  `;
}

function renderCategories() {
  const grouped = countBy(currentRecords, (record) => record.category.id);
  const max = Math.max(1, ...CATEGORY_DEFS.map((definition) => grouped.get(definition.id) || 0));
  return `
    <div class="section-title">
      <h3>分类统计</h3>
      <span>${formatNumber(currentRecords.length)} files</span>
    </div>
    <div class="category-bars">
      ${CATEGORY_DEFS.map((definition) => {
        const count = grouped.get(definition.id) || 0;
        return `
          <div class="category-bar">
            <strong>${escapeHtml(definition.label)}</strong>
            <div class="bar-track" aria-hidden="true"><span style="width: ${(count / max) * 100}%"></span></div>
            <em>${formatNumber(count)}</em>
          </div>
        `;
      }).join("")}
    </div>
    ${renderCategoryRulePanel()}
    <div class="grid-two">
      ${CATEGORY_DEFS.map(renderCategoryCard).join("")}
    </div>
  `;
}

function renderCategoryRulePanel() {
  const ruleRows = customCategoryRules.map((rule) => `
    <div class="rule-row">
      <span>包含 <strong>${escapeHtml(rule.keyword)}</strong></span>
      <span>识别为 <strong>${escapeHtml(CATEGORY_BY_ID.get(rule.categoryId)?.label || rule.categoryId)}</strong></span>
      <button type="button" data-remove-rule="${escapeHtml(rule.id)}">删除</button>
    </div>
  `).join("");
  return `
    <article class="rule-panel">
      <div>
        <h4>分类规则微调</h4>
        <p>把路径里包含某个词的开放文件固定识别为指定分类。封包仍然只做提示，不会因为规则变成可复制素材。</p>
      </div>
      <div class="rule-form">
        <input id="ruleKeywordInput" type="text" maxlength="60" placeholder="例如 tachie、event、voice" />
        <select id="ruleCategorySelect">
          ${CATEGORY_DEFS.map((definition) => `<option value="${escapeHtml(definition.id)}">${escapeHtml(definition.label)}</option>`).join("")}
        </select>
        <button id="addRuleButton" type="button">添加规则</button>
      </div>
      <div class="rule-list">
        ${ruleRows || "<p>还没有自定义分类规则。</p>"}
      </div>
    </article>
  `;
}

function renderCategoryCard(definition) {
  const records = currentRecords.filter((record) => record.category.id === definition.id);
  return `
    <article class="asset-card">
      <h4>${escapeHtml(definition.label)}</h4>
      <p>${formatNumber(records.length)} 个文件，${formatBytes(records.reduce((sum, record) => sum + record.size, 0))}</p>
      <div class="sample-list">
        ${records.slice(0, 5).map((record) => `<code>${escapeHtml(record.path)}</code>`).join("") || "<span>暂无</span>"}
      </div>
    </article>
  `;
}

function renderArchives(archives) {
  return `
    <div class="section-title">
      <h3>封包提示</h3>
      <span>${formatNumber(archives.length)} index-only</span>
    </div>
    <article class="notice-card">
      <h4>识别但不拆包</h4>
      <p>这些通常是引擎资源包或受保护资源。GalAssetBox 只记录路径和大小，不提供解密、破解或绕过 DRM 的步骤。</p>
    </article>
    <div class="sample-list archive-list">
      ${archives.slice(0, 80).map((record) => `<code>${escapeHtml(record.path)} · ${formatBytes(record.size)}</code>`).join("") || "<p>没有发现常见资源封包。</p>"}
    </div>
  `;
}

function renderAuthorizedPlugins() {
  const pluginDescriptions = describeAuthorizedPlugins();
  const matches = currentRecords.length ? getAuthorizedPluginMatches(currentRecords) : [];
  const runnableMatches = getTransformPluginMatches(currentRecords);
  const demoState = getTrialRunState(pluginDescriptions, matches, runnableMatches);
  const pluginCards = pluginDescriptions.map((plugin) => `
    <article class="plugin-card">
      <div>
        <h4>${escapeHtml(plugin.name)}</h4>
        <p>${escapeHtml(plugin.description)}</p>
      </div>
      <div class="plugin-meta">
        <span class="plugin-badge ${plugin.enabled ? "enabled" : "disabled"}">${plugin.enabled ? "已启用" : "已停用"}</span>
        <span class="plugin-badge ${plugin.defaultEnabled ? "enabled" : "disabled"}">${plugin.defaultEnabled ? "默认启用" : "默认关闭"}</span>
        <span class="plugin-badge ${plugin.canTransform ? "enabled" : "disabled"}">${plugin.canTransform ? "可执行" : "只识别"}</span>
        <span class="plugin-badge ${plugin.source !== "built-in" ? "enabled" : "disabled"}">${escapeHtml(formatPluginSource(plugin.source))}</span>
        ${plugin.capabilities.map((capability) => `<span class="chip">${escapeHtml(capability)}</span>`).join("")}
      </div>
      <button
        class="plugin-toggle-button"
        data-plugin-toggle="${escapeHtml(plugin.id)}"
        data-next-enabled="${plugin.enabled ? "false" : "true"}"
        type="button"
      >
        ${plugin.enabled ? "停用插件" : "启用插件"}
      </button>
      <p class="plugin-source">来源：${escapeHtml(plugin.sourceName || plugin.source || "unknown")}${plugin.importedAt ? ` · ${escapeHtml(new Date(plugin.importedAt).toLocaleString("zh-CN"))}` : ""}</p>
      ${plugin.notes ? `<p class="plugin-note">${escapeHtml(plugin.notes)}</p>` : ""}
    </article>
  `).join("");

  const matchRows = matches.slice(0, 80).map((match) => {
    const stateLabel = match.canTransform
      ? (match.record.handle || match.record.desktopSourcePath) ? "可执行" : "需真实文件夹"
      : match.result.confidence || "match";
    return `
    <article class="match-row">
      <div>
        <strong>${escapeHtml(match.result.label || match.pluginName)}</strong>
        <p>${escapeHtml(match.record.path)}</p>
      </div>
      <span>${escapeHtml(stateLabel)}</span>
    </article>
  `;
  }).join("");

  const installCards = pluginDescriptions.map((plugin) => `
    <article class="install-card">
      <div>
        <h4>${escapeHtml(plugin.packageName || plugin.name)}</h4>
        <p>${escapeHtml(plugin.packageDescription || plugin.description)}</p>
      </div>
      <div class="install-meta">
        <span>${escapeHtml(formatPluginSource(plugin.source))}</span>
        <span>v${escapeHtml(plugin.version || "0.1.0")}</span>
        <span>${escapeHtml(plugin.author || "unknown")}</span>
        ${plugin.license ? `<span>${escapeHtml(plugin.license)}</span>` : ""}
      </div>
      <dl class="install-details">
        <div><dt>插件 ID</dt><dd>${escapeHtml(plugin.id)}</dd></div>
        <div><dt>来源</dt><dd>${escapeHtml(plugin.sourceName || "built-in")}</dd></div>
        ${plugin.sourceMain ? `<div><dt>入口</dt><dd>${escapeHtml(plugin.sourceMain)}</dd></div>` : ""}
        ${plugin.importedAt ? `<div><dt>导入时间</dt><dd>${escapeHtml(new Date(plugin.importedAt).toLocaleString("zh-CN"))}</dd></div>` : ""}
      </dl>
    </article>
  `).join("");

  return `
    <div class="section-title">
      <h3>授权插件</h3>
      <span>API ${escapeHtml(window.GalAssetBoxPluginHost?.apiVersion || "unavailable")}</span>
    </div>
    <article class="notice-card">
      <h4>接口边界</h4>
      <p>插件用于自制、开源或明确授权的项目格式。GalAssetBox 不内置第三方游戏密钥、破解规则、DRM 绕过、授权校验绕过或联网上传。</p>
    </article>
    <div class="policy-list">
      <span>必须本地运行</span>
      <span>必须用户授权</span>
      <span>不得内置第三方密钥</span>
      <span>不得绕过 DRM / 授权</span>
    </div>
    <div class="plugin-action-row">
      <button id="runPluginsInlineButton" type="button" ${!(sourceHandle || desktopSource) || !(outputHandle || desktopOutput) || !runnableMatches.length ? "disabled" : ""}>运行授权插件</button>
      <button id="downloadDiagnosticInlineButton" type="button">导出诊断包</button>
      <span>${formatNumber(runnableMatches.length)} 个可执行匹配项</span>
    </div>
    ${renderTrialRunGuide(demoState)}
    ${renderPluginRunPreview(lastPluginRun)}
    <div class="section-title">
      <h3>已安装插件</h3>
      <span>${formatNumber(pluginDescriptions.length)} plugins</span>
    </div>
    <div class="plugin-manager-row">
      <button id="importPluginInlineButton" type="button">导入本地插件</button>
      <button id="importPluginPackageInlineButton" type="button">导入插件包</button>
      <button id="resetPluginsButton" type="button">恢复默认插件状态</button>
      <span>开关状态会保存在当前浏览器本地。</span>
    </div>
    <div class="section-title">
      <h3>插件安装区</h3>
      <span>${formatNumber(pluginDescriptions.filter((plugin) => plugin.source !== "built-in").length)} imported</span>
    </div>
    <div class="install-list">${installCards}</div>
    <div class="grid-two">${pluginCards || `<article class="notice-card"><h4>没有插件</h4><p>可以按照文档添加本地授权插件。</p></article>`}</div>
    <div class="section-title">
      <h3>当前匹配</h3>
      <span>${formatNumber(matches.length)} matches</span>
    </div>
    <div class="match-list">${matchRows || `<article class="notice-card"><h4>暂无匹配</h4><p>扫描游戏文件夹后，这里会显示已启用插件识别到的文件。</p></article>`}</div>
  `;
}

function renderPluginRunPreview(run) {
  if (!run) {
    return `
      <div class="section-title">
        <h3>最近输出结果</h3>
        <span>none</span>
      </div>
      <article class="output-preview empty">
        <h4>还没有运行授权插件</h4>
        <p>完成试跑向导后，这里会显示结果文件夹、报告、清单和前几条输出文件路径。</p>
      </article>
    `;
  }

  const writtenRows = run.rows.filter((row) => row.status === "written");
  const failedRows = run.rows.filter((row) => row.status === "failed");
  const sampleRows = writtenRows.slice(0, 8);
  const expectedDemo = writtenRows.find((row) => row.outputPath.includes("package-demo/summary.txt"));

  return `
    <div class="section-title">
      <h3>最近输出结果</h3>
      <span>${escapeHtml(new Date(run.finishedAt).toLocaleString("zh-CN"))}</span>
    </div>
    <article class="output-preview">
      <div>
        <h4>${escapeHtml(run.resultRootName)}</h4>
        <p>输出位置在你选择的输出文件夹：${escapeHtml(run.outputFolderName)}。${run.desktopResultPath ? "桌面版可以直接打开结果文件夹。" : "浏览器网页不能直接替你打开系统文件夹，请到这个文件夹里查看下面这些文件。"}</p>
      </div>
      <div class="output-summary-grid">
        <span>写入 ${formatNumber(run.written)} 个文件</span>
        <span>失败 ${formatNumber(run.failed)} 个匹配项</span>
        <span>匹配 ${formatNumber(run.totalMatches)} 项</span>
      </div>
      <div class="output-paths">
        <code>${escapeHtml(run.reportPath)}</code>
        <code>${escapeHtml(run.csvPath)}</code>
        <code>${escapeHtml(run.outputRootPath)}</code>
        ${expectedDemo ? `<code>${escapeHtml(`${run.resultRootName}/${expectedDemo.outputPath}`)}</code>` : ""}
      </div>
      ${
        run.desktopResultPath
          ? `<div class="result-action-row"><button type="button" data-open-desktop-path="${escapeHtml(run.desktopResultPath)}">打开结果文件夹</button></div>`
          : ""
      }
      <div class="section-title compact-title">
        <h3>输出样例</h3>
        <span>${formatNumber(writtenRows.length)} written</span>
      </div>
      <div class="output-row-list">
        ${
          sampleRows.length
            ? sampleRows.map((row) => `<code>${escapeHtml(`${run.resultRootName}/${row.outputPath}`)}</code>`).join("")
            : "<p>插件没有写出文件。</p>"
        }
      </div>
      ${
        failedRows.length
          ? `<div class="output-error-list">${failedRows.slice(0, 5).map((row) => `<p>${escapeHtml(`${row.pluginId} / ${row.sourcePath}: ${row.message}`)}</p>`).join("")}</div>`
          : ""
      }
    </article>
  `;
}

function getTrialRunState(pluginDescriptions, matches, runnableMatches) {
  const packagePlugin = pluginDescriptions.find((plugin) => plugin.id === "example.package-demo-authorized-pack");
  const hasPackagePlugin = Boolean(packagePlugin);
  const packagePluginEnabled = packagePlugin?.enabled === true;
  const scannedSample = currentRecords.some((record) => record.path.toLowerCase().endsWith("sample.packagepack.json"));
  const matchedSample = matches.some((match) => match.pluginId === "example.package-demo-authorized-pack");
  const runnableSample = runnableMatches.some((match) => match.pluginId === "example.package-demo-authorized-pack");
  const steps = [
    {
      id: "source",
      done: Boolean(sourceHandle || desktopSource),
      title: "选择示例源目录",
      body: "点左侧“选择游戏文件夹”，选择 examples/plugin-package-demo 文件夹。",
    },
    {
      id: "output",
      done: Boolean(outputHandle || desktopOutput),
      title: "选择输出文件夹",
      body: "点左侧“选择输出文件夹”，选一个空文件夹或临时测试文件夹。",
    },
    {
      id: "import",
      done: hasPackagePlugin,
      title: "导入示例插件包",
      body: "点“导入插件包”，选择 examples/plugin-package-demo 文件夹；确认后安装区会出现“插件包示例：授权 JSON 包”。",
    },
    {
      id: "enabled",
      done: hasPackagePlugin && packagePluginEnabled,
      title: "确认插件已启用",
      body: "如果插件卡片显示“已停用”，点“启用插件”。",
    },
    {
      id: "scan",
      done: scannedSample,
      title: "扫描示例文件",
      body: "点左侧“扫描素材”，当前匹配里应出现 sample.packagepack.json。",
    },
    {
      id: "run",
      done: runnableSample,
      title: "运行授权插件",
      body: "点“运行授权插件”，确认后输出会写到 GalAssetBox_授权插件结果_日期时间。",
    },
  ];

  return {
    hasPackagePlugin,
    packagePluginEnabled,
    scannedSample,
    matchedSample,
    runnableSample,
    steps,
  };
}

function renderTrialRunGuide(state) {
  const completed = state.steps.filter((step) => step.done).length;
  const nextStep = state.steps.find((step) => !step.done);
  const stepCards = state.steps.map((step, index) => `
    <article class="trial-step ${step.done ? "done" : ""}">
      <span>${step.done ? "完成" : `步骤 ${index + 1}`}</span>
      <div>
        <h4>${escapeHtml(step.title)}</h4>
        <p>${escapeHtml(step.body)}</p>
      </div>
    </article>
  `).join("");

  return `
    <div class="section-title">
      <h3>真实试跑向导</h3>
      <span>${completed} / ${state.steps.length} done</span>
    </div>
    <article class="trial-card">
      <div>
        <h4>${nextStep ? `下一步：${escapeHtml(nextStep.title)}` : "示例流程已准备好"}</h4>
        <p>${nextStep ? escapeHtml(nextStep.body) : "现在可以点击“运行授权插件”，再到输出文件夹查看插件结果。"}</p>
      </div>
      <div class="trial-paths">
        <code>examples/plugin-package-demo/</code>
        <code>examples/plugin-package-demo/plugin.json</code>
        <code>examples/plugin-package-demo/sample.packagepack.json</code>
      </div>
      <div class="trial-status-grid">
        <span class="${state.hasPackagePlugin ? "ok" : ""}">插件包 ${state.hasPackagePlugin ? "已导入" : "未导入"}</span>
        <span class="${state.packagePluginEnabled ? "ok" : ""}">插件 ${state.packagePluginEnabled ? "已启用" : "未启用"}</span>
        <span class="${state.scannedSample ? "ok" : ""}">示例文件 ${state.scannedSample ? "已扫描" : "未扫描"}</span>
        <span class="${state.runnableSample ? "ok" : ""}">运行条件 ${state.runnableSample ? "已满足" : "未满足"}</span>
      </div>
    </article>
    <div class="trial-step-list">${stepCards}</div>
  `;
}

function formatPluginSource(source) {
  if (source === "built-in") return "内置";
  if (source === "package") return "插件包";
  if (source === "external-file") return "单文件";
  return "外部导入";
}

function renderLog() {
  return `
    <div class="section-title"><h3>运行日志</h3><span>${formatNumber(currentLog.length)} lines</span></div>
    <div class="log-box">${currentLog.map((line) => `<p>${escapeHtml(line)}</p>`).join("") || "<p>暂无日志。</p>"}</div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getToastRegion() {
  const existingRegion = document.querySelector("#toastRegion");
  if (existingRegion instanceof HTMLElement) return existingRegion;

  const region = document.createElement("div");
  region.id = "toastRegion";
  region.className = "toast-region";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "false");
  region.setAttribute("aria-relevant", "additions text");
  document.body.append(region);
  return region;
}

function updateToastCount(toast, count) {
  const countBadge = toast.querySelector(".toast-count");
  toast.dataset.toastCount = String(count);
  if (countBadge instanceof HTMLElement) {
    const formattedCount = formatNumber(count);
    const countLabel = `重复出现 ${formattedCount} 次`;
    countBadge.hidden = false;
    countBadge.textContent = `${formattedCount} 次`;
    countBadge.setAttribute("aria-label", countLabel);
    countBadge.title = countLabel;
  }
}

function pruneToastRegion(region) {
  while (region.children.length >= MAX_VISIBLE_TOASTS) {
    const oldestToast = region.firstElementChild;
    if (!(oldestToast instanceof HTMLElement)) break;
    const controller = toastControllers.get(oldestToast);
    if (controller) controller.remove();
    else oldestToast.remove();
  }
}

function scrollToastRegionToLatest(region) {
  region.scrollTop = region.scrollHeight;
}

function getToastDismissLabel(message) {
  if (!message) return "关闭提示";
  const trimmedMessage = message.length > TOAST_DISMISS_LABEL_MAX_CHARS
    ? `${message.slice(0, TOAST_DISMISS_LABEL_MAX_CHARS - 3)}...`
    : message;
  return `关闭提示：${trimmedMessage}`;
}

function showToast(message) {
  const messageValue = String(message ?? "").trim();
  if (!messageValue) return;
  const region = getToastRegion();
  const existingToast = [...region.querySelectorAll(".toast")]
    .find((toast) => toast instanceof HTMLElement && toast.dataset.toastMessage === messageValue);
  if (existingToast instanceof HTMLElement) {
    const count = Number(existingToast.dataset.toastCount || "1") + 1;
    updateToastCount(existingToast, count);
    region.append(existingToast);
    scrollToastRegionToLatest(region);
    toastControllers.get(existingToast)?.reset();
    return;
  }

  pruneToastRegion(region);
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.toastMessage = messageValue;
  toast.dataset.toastCount = "1";
  const messageText = document.createElement("span");
  messageText.className = "toast-message";
  messageText.textContent = messageValue;
  const countBadge = document.createElement("span");
  countBadge.className = "toast-count";
  countBadge.hidden = true;
  countBadge.setAttribute("aria-label", "");
  const dismissButton = document.createElement("button");
  dismissButton.className = "toast-dismiss";
  dismissButton.type = "button";
  const dismissLabel = getToastDismissLabel(messageValue);
  dismissButton.setAttribute("aria-label", dismissLabel);
  dismissButton.setAttribute("aria-keyshortcuts", "Escape");
  dismissButton.title = `${dismissLabel}；Esc`;
  dismissButton.textContent = "x";
  toast.append(messageText, countBadge, dismissButton);
  region.append(toast);
  scrollToastRegionToLatest(region);

  let timeoutId = 0;
  let startedAt = 0;
  let remainingTime = TOAST_DURATION_MS;
  let isPaused = false;

  const removeToast = () => {
    const shouldRestoreFocus = toast.contains(document.activeElement);
    const nextToast = toast.nextElementSibling instanceof HTMLElement
      ? toast.nextElementSibling
      : toast.previousElementSibling;
    const nextDismissButton = nextToast instanceof HTMLElement
      ? nextToast.querySelector(".toast-dismiss")
      : null;
    window.clearTimeout(timeoutId);
    toastControllers.delete(toast);
    toast.remove();
    if (!region.children.length) region.remove();
    if (shouldRestoreFocus && nextDismissButton instanceof HTMLButtonElement) {
      nextDismissButton.focus();
    }
  };

  const scheduleRemoval = () => {
    startedAt = Date.now();
    timeoutId = window.setTimeout(removeToast, remainingTime);
  };

  const pauseRemoval = () => {
    if (isPaused) return;
    isPaused = true;
    window.clearTimeout(timeoutId);
    remainingTime = Math.max(600, remainingTime - (Date.now() - startedAt));
  };

  const resumeRemoval = () => {
    if (!isPaused) return;
    isPaused = false;
    scheduleRemoval();
  };

  const resetRemoval = () => {
    window.clearTimeout(timeoutId);
    remainingTime = TOAST_DURATION_MS;
    if (toast.matches(":hover") || toast.contains(document.activeElement)) {
      isPaused = true;
      return;
    }
    isPaused = false;
    scheduleRemoval();
  };

  toast.addEventListener("pointerenter", pauseRemoval);
  toast.addEventListener("pointerleave", resumeRemoval);
  toast.addEventListener("focusin", pauseRemoval);
  toast.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && toast.contains(event.relatedTarget)) return;
    resumeRemoval();
  });
  toast.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    removeToast();
  });
  dismissButton.addEventListener("click", removeToast);
  toastControllers.set(toast, { remove: removeToast, reset: resetRemoval });
  scheduleRemoval();
}

function pause() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function downloadText(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function joinDesktopPath(root, child) {
  const rootText = String(root || "");
  const separator = rootText.includes("\\") && !rootText.includes("/") ? "\\" : "/";
  return `${rootText.replace(/[\\/]+$/g, "")}${separator}${child}`;
}

async function openDesktopPath(targetPath) {
  if (!desktopBridge || !targetPath) {
    showToast("网页版不能直接打开系统文件夹");
    return;
  }
  const result = await desktopBridge.openPath(targetPath);
  if (!result?.ok) {
    showToast(result?.error || "打开文件夹失败");
    currentLog.push(`打开文件夹失败：${result?.error || targetPath}`);
  } else {
    currentLog.push(`已打开结果文件夹：${getBaseName(targetPath)}`);
  }
  render();
}

function loadManifestFiles(files) {
  currentRecords = [...files].map((file) =>
    makeRecord({
      path: file.webkitRelativePath || file.name,
      size: file.size,
      handle: null,
    }),
  );
  sourceHandle = null;
  outputHandle = null;
  desktopSource = null;
  desktopOutput = null;
  lastOrganizeRun = null;
  lastPluginRun = null;
  sourceName.textContent = "清单模式";
  outputName.textContent = "未选择";
  projectTitle.textContent = "清单模式";
  currentLog = [`已生成清单：${formatNumber(currentRecords.length)} 个文件。`];
  setProgress("清单已生成", summarizeRecords(currentRecords), 100, "success");
  setStatus("Manifest", "ready");
  updateActionState();
  render();
  downloadText("GalAssetBox_素材清单.csv", buildCsvReport(currentRecords), "text/csv;charset=utf-8");
}

pickSourceButton.addEventListener("click", () => {
  void pickSource().catch((error) => {
    if (error.name !== "AbortError") showToast(error.message);
  });
});

pickOutputButton.addEventListener("click", () => {
  void pickOutput().catch((error) => {
    if (error.name !== "AbortError") showToast(error.message);
  });
});

scanButton.addEventListener("click", () => {
  void scanSourceDirectory();
});

organizeButton.addEventListener("click", () => {
  void organizeAssets();
});

runPluginsButton.addEventListener("click", () => {
  void runAuthorizedPlugins();
});

categoryPresets.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  const button = event.target.closest("[data-category-preset]");
  if (!(button instanceof HTMLElement)) return;
  applyCategoryPreset(button.dataset.categoryPreset || "");
});

categoryPresets.addEventListener("keydown", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  moveFocusInButtonGroup(categoryPresets, event.target, event.key);
});

importPluginButton.addEventListener("click", () => importPluginInput.click());
importPluginPackageButton.addEventListener("click", () => importPluginPackageInput.click());
helpSummaryButton.addEventListener("click", () => downloadHelpSummary());
importPluginInput.addEventListener("change", () => {
  const file = importPluginInput.files?.[0];
  importPluginInput.value = "";
  if (file) void importExternalPluginFile(file);
});
importPluginPackageInput.addEventListener("change", () => {
  const files = importPluginPackageInput.files;
  importPluginPackageInput.value = "";
  if (files?.length) void importExternalPluginPackage(files);
});

manifestOnlyButton.addEventListener("click", () => manifestInput.click());
manifestInput.addEventListener("change", () => {
  if (manifestInput.files.length) loadManifestFiles(manifestInput.files);
  manifestInput.value = "";
});

sampleButton.addEventListener("click", () => {
  currentRecords = SAMPLE_RECORDS;
  sourceHandle = null;
  outputHandle = null;
  desktopSource = null;
  desktopOutput = null;
  lastOrganizeRun = null;
  lastPluginRun = null;
  sourceName.textContent = "样例";
  outputName.textContent = "未选择";
  projectTitle.textContent = "样例预览";
  currentLog = ["已载入样例数据。"];
  setProgress("样例已载入", summarizeRecords(currentRecords), 100, "success");
  setStatus("Sample", "ready");
  updateActionState();
  render();
});

beginnerModeButton.addEventListener("click", () => {
  setUiMode("beginner");
});

advancedModeButton.addEventListener("click", () => {
  setUiMode("advanced");
});

modeSwitch.addEventListener("keydown", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  moveFocusInButtonGroup(modeSwitch, event.target, event.key);
});

overviewPanel.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.id === "downloadHelpSummaryInlineButton") {
    downloadHelpSummary();
    return;
  }
  const openButton = event.target.closest("[data-open-desktop-path]");
  if (openButton instanceof HTMLElement) {
    void openDesktopPath(openButton.dataset.openDesktopPath || "");
  }
});

categoriesPanel.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.id === "addRuleButton") {
    const keywordInput = document.querySelector("#ruleKeywordInput");
    const categorySelect = document.querySelector("#ruleCategorySelect");
    if (!(keywordInput instanceof HTMLInputElement) || !(categorySelect instanceof HTMLSelectElement)) return;
    addCustomCategoryRule(keywordInput.value, categorySelect.value);
    return;
  }
  const removeButton = event.target.closest("[data-remove-rule]");
  if (removeButton instanceof HTMLElement) {
    removeCustomCategoryRule(removeButton.dataset.removeRule || "");
  }
});

categoriesPanel.addEventListener("keydown", (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.id !== "ruleKeywordInput") return;
  if (event.key !== "Enter") return;
  const categorySelect = document.querySelector("#ruleCategorySelect");
  if (!(categorySelect instanceof HTMLSelectElement)) return;
  addCustomCategoryRule(event.target.value, categorySelect.value);
});

function activateTab(tab, shouldFocus = false) {
  const targetPanel = document.querySelector(`#${tab.dataset.tab}Panel`);
  if (!(targetPanel instanceof HTMLElement)) return;

  document.querySelectorAll(".tab").forEach((button) => {
    const isActive = button === tab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isActive = panel === targetPanel;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });

  if (shouldFocus) tab.focus();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activateTab(tab);
  });

  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll(".tab")];
    const currentIndex = tabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;
    activateTab(tabs[nextIndex], true);
  });
});

authorizedPluginsPanel.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  const openButton = event.target.closest("[data-open-desktop-path]");
  if (openButton instanceof HTMLElement) {
    void openDesktopPath(openButton.dataset.openDesktopPath || "");
    return;
  }
  const toggleButton = event.target.closest("[data-plugin-toggle]");
  if (toggleButton instanceof HTMLElement) {
    const pluginId = toggleButton.dataset.pluginToggle;
    const nextEnabled = toggleButton.dataset.nextEnabled === "true";
    if (!pluginId) return;
    setAuthorizedPluginEnabled(pluginId, nextEnabled);
    currentLog.push(`插件${nextEnabled ? "已启用" : "已停用"}：${pluginId}`);
    render();
    return;
  }
  if (event.target.id === "resetPluginsButton") {
    window.GalAssetBoxPluginHost?.resetPluginEnabledState?.();
    currentLog.push("已恢复默认插件启用状态。");
    render();
    return;
  }
  if (event.target.id === "importPluginInlineButton") {
    importPluginInput.click();
    return;
  }
  if (event.target.id === "importPluginPackageInlineButton") {
    importPluginPackageInput.click();
    return;
  }
  if (event.target.id === "runPluginsInlineButton") {
    void runAuthorizedPlugins();
  }
  if (event.target.id === "downloadDiagnosticInlineButton") {
    downloadDiagnosticPackage();
  }
});

renderCategoryOptions();
applyUiMode();
if (!("showDirectoryPicker" in window)) {
  setProgress("浏览器能力受限", "可生成素材清单；直接复制整理需要 Chrome / Edge 的文件夹权限。", 100, "warn");
  setStatus("Manifest only", "warn");
}
renderEmpty();
updateActionState();
