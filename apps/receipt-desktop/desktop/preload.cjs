const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("receiptDesktop", Object.freeze({
  saveWorkbook(fileName, bytes) {
    return ipcRenderer.invoke("receipt:save-workbook", { fileName, bytes });
  },
}));
