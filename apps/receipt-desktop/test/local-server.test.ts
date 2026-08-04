import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAssetPath, startLocalServer } from "../desktop/local-server.js";

describe("desktop static server", () => {
  const root = path.resolve("renderer-dist");

  it("serves the renderer root and nested assets inside the package", () => {
    expect(resolveAssetPath(root, "/")).toBe(path.join(root, "index.html"));
    expect(resolveAssetPath(root, "/assets/app.js")).toBe(path.join(root, "assets", "app.js"));
  });

  it("rejects encoded and plain path traversal", () => {
    expect(resolveAssetPath(root, "/../package.json")).toBeNull();
    expect(resolveAssetPath(root, "/%2e%2e/package.json")).toBeNull();
  });

  it("serves the renderer with restrictive headers and WebAssembly enabled", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "leimuovo-desktop-server-"));
    const server = await startLocalServer(temporaryRoot);
    try {
      await writeFile(path.join(temporaryRoot, "index.html"), "<!doctype html><title>test</title>");
      const response = await fetch(server.origin);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      await server.close();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
