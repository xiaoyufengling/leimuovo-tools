import { describe, expect, it } from "vitest";
import { createWindowOptions, isTrustedNavigation } from "../desktop/window-options.js";

describe("desktop window security", () => {
  it("keeps the renderer sandboxed and isolated from Node", () => {
    const options = createWindowOptions("icon.ico", "preload.cjs");
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it("allows only navigation within the loopback application origin", () => {
    const origin = "http://127.0.0.1:41751/";
    expect(isTrustedNavigation("http://127.0.0.1:41751/index.html", origin)).toBe(true);
    expect(isTrustedNavigation("https://example.com/", origin)).toBe(false);
    expect(isTrustedNavigation("not a url", origin)).toBe(false);
  });
});
