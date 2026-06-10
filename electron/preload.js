const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("GalAssetBoxDesktop", {
  platform: process.platform,
  pickDirectory(role) {
    return ipcRenderer.invoke("desktop:pick-directory", role);
  },
  scanDirectory(rootPath) {
    return ipcRenderer.invoke("desktop:scan-directory", rootPath);
  },
  useDirectoryAsSource(targetPath) {
    return ipcRenderer.invoke("desktop:use-directory-as-source", targetPath);
  },
  organizeAssets(payload) {
    return ipcRenderer.invoke("desktop:organize-assets", payload);
  },
  readFileText(filePath) {
    return ipcRenderer.invoke("desktop:read-file-text", filePath);
  },
  readFileArrayBuffer(filePath) {
    return ipcRenderer.invoke("desktop:read-file-array-buffer", filePath);
  },
  writePluginOutput(payload) {
    return ipcRenderer.invoke("desktop:write-plugin-output", payload);
  },
  writePluginRunReports(payload) {
    return ipcRenderer.invoke("desktop:write-plugin-run-reports", payload);
  },
  getExtractorStatus() {
    return ipcRenderer.invoke("desktop:get-extractor-status");
  },
  planExtraction(payload) {
    return ipcRenderer.invoke("desktop:plan-extraction", payload);
  },
  extractCommonArchives(payload) {
    return ipcRenderer.invoke("desktop:extract-common-archives", payload);
  },
  pickExtractorTool(toolId) {
    return ipcRenderer.invoke("desktop:pick-extractor-tool", toolId);
  },
  clearExtractorTool(toolId) {
    return ipcRenderer.invoke("desktop:clear-extractor-tool", toolId);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke("desktop:open-path", targetPath);
  },
});
