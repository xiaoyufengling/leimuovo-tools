export function createWindowOptions(iconPath, preloadPath) {
  return {
    title: "小鱼 小票验算",
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#0B0B0D",
    autoHideMenuBar: true,
    icon: iconPath,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  };
}

export function isTrustedNavigation(targetUrl, trustedOrigin) {
  try {
    return new URL(targetUrl).origin === new URL(trustedOrigin).origin;
  } catch {
    return false;
  }
}
