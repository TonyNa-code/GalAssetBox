const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("GalAssetBoxDesktop", {
  platform: process.platform,
  pickDirectory(role) {
    return ipcRenderer.invoke("desktop:pick-directory", role);
  },
  scanDirectory(rootPath) {
    return ipcRenderer.invoke("desktop:scan-directory", rootPath);
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
  openPath(targetPath) {
    return ipcRenderer.invoke("desktop:open-path", targetPath);
  },
});
