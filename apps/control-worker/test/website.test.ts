import { describe, expect, it } from "vitest";
import { createWebsiteStatusProvider } from "../src/website";

describe("website status provider", () => {
  it("reports a successful Cloudflare-backed HTTPS response", async () => {
    const provider = createWebsiteStatusProvider({
      targetUrl: "https://leimuovo.com/",
      fetch: async () => new Response(null, { status: 200, headers: { "CF-Ray": "test-ray" } }),
      now: () => Date.UTC(2026, 7, 6, 9, 15, 0),
      monotonicNow: (() => {
        const values = [100, 137];
        return () => values.shift() ?? 137;
      })(),
    });

    await expect(provider.check()).resolves.toEqual({
      site: { state: "up", checkedAt: "2026-08-06T09:15:00.000Z", latencyMs: 37, stale: false, message: "网站可用" },
      https: { state: "up", checkedAt: "2026-08-06T09:15:00.000Z", latencyMs: 37, stale: false, message: "HTTPS 正常" },
      cloudflare: { state: "up", checkedAt: "2026-08-06T09:15:00.000Z", latencyMs: 37, stale: false, message: "Cloudflare 正常" },
      latestDeploymentAt: null,
    });
  });

  it("marks Cloudflare as degraded when its response headers are absent", async () => {
    const provider = createWebsiteStatusProvider({
      targetUrl: "https://leimuovo.com/",
      fetch: async () => new Response(null, { status: 204 }),
    });

    const result = await provider.check();
    expect(result.site.state).toBe("up");
    expect(result.https.state).toBe("up");
    expect(result.cloudflare).toMatchObject({ state: "degraded", message: "未检测到 Cloudflare 响应标识" });
  });

  it("reports a failed HTTPS request without throwing", async () => {
    const provider = createWebsiteStatusProvider({
      targetUrl: "https://leimuovo.com/",
      fetch: async () => { throw new Error("network unavailable"); },
    });

    const result = await provider.check();
    expect(result.site.state).toBe("down");
    expect(result.https.state).toBe("down");
    expect(result.cloudflare.state).toBe("unknown");
    expect(result.site.latencyMs).toBeNull();
  });
});
