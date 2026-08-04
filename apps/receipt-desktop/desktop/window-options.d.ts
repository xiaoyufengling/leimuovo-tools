import type { BrowserWindowConstructorOptions } from "electron";

export function createWindowOptions(iconPath: string, preloadPath: string): BrowserWindowConstructorOptions;
export function isTrustedNavigation(targetUrl: string, trustedOrigin: string): boolean;
