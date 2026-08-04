import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import { startLocalServer } from "./local-server.js";
import { createWindowOptions, isTrustedNavigation } from "./window-options.js";
import { persistWorkbookRequest } from "./workbook-save.js";

const DESKTOP_PORT = 41751;
let localServer;
let mainWindow;

function createMainWindow() {
  const appRoot = app.getAppPath();
  const window = new BrowserWindow(createWindowOptions(
    path.join(appRoot, "build", "app-icon.ico"),
    path.join(appRoot, "desktop", "preload.cjs"),
  ));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedNavigation(url, localServer.origin)) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => { if (mainWindow === window) mainWindow = undefined; });
  void window.loadURL(localServer.origin);
  return window;
}

function registerWorkbookSaveHandler() {
  ipcMain.handle("receipt:save-workbook", (event, payload) => persistWorkbookRequest({
    senderUrl: event.senderFrame?.url ?? "",
    trustedOrigin: localServer.origin,
    payload,
    automatedDirectory: process.env.RECEIPT_CHECKER_EXPORT_DIRECTORY,
    chooseDestination: async (fileName) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "保存 Excel 表格",
        defaultPath: path.join(app.getPath("downloads"), fileName),
        buttonLabel: "保存",
        filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
      });
      return result.canceled || !result.filePath ? null : result.filePath;
    },
  }));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    localServer = await startLocalServer(path.join(app.getAppPath(), "renderer-dist"), { preferredPort: DESKTOP_PORT });
    registerWorkbookSaveHandler();
    mainWindow = createMainWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow(); });
  }).catch((error) => { console.error("Failed to start desktop app", error); app.quit(); });
  app.on("window-all-closed", () => app.quit());
  app.once("before-quit", () => { void localServer?.close(); });
}
