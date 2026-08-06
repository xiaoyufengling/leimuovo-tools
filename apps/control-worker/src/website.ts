import type { StatusCheck, StatusProvider, WebsiteStatus } from "@leimuovo/control-core";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface WebsiteProviderOptions {
  targetUrl: string;
  fetch?: Fetcher;
  now?: () => number;
  monotonicNow?: () => number;
  timeoutMs?: number;
}

function status(
  state: StatusCheck["state"],
  checkedAt: string,
  latencyMs: number | null,
  message: string,
): StatusCheck {
  return { state, checkedAt, latencyMs, stale: false, message };
}

export function createWebsiteStatusProvider(options: WebsiteProviderOptions): StatusProvider<WebsiteStatus> {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const timeoutMs = options.timeoutMs ?? 5_000;

  return {
    async check(parentSignal) {
      const checkedAt = new Date(now()).toISOString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abort = () => controller.abort();
      parentSignal?.addEventListener("abort", abort, { once: true });
      const startedAt = monotonicNow();

      try {
        const response = await fetcher(options.targetUrl, {
          method: "HEAD",
          redirect: "follow",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "text/html" },
        });
        const latencyMs = Math.max(0, Math.round(monotonicNow() - startedAt));
        const siteUp = response.status >= 200 && response.status < 400;
        const cloudflareDetected = Boolean(
          response.headers.get("CF-Ray")
          || response.headers.get("CF-Cache-Status")
          || response.headers.get("Server")?.toLowerCase() === "cloudflare",
        );

        return {
          site: status(siteUp ? "up" : "down", checkedAt, latencyMs, siteUp ? "网站可用" : `网站返回 ${response.status}`),
          https: status("up", checkedAt, latencyMs, "HTTPS 正常"),
          cloudflare: status(
            cloudflareDetected ? "up" : "degraded",
            checkedAt,
            latencyMs,
            cloudflareDetected ? "Cloudflare 正常" : "未检测到 Cloudflare 响应标识",
          ),
          latestDeploymentAt: null,
        };
      } catch {
        return {
          site: status("down", checkedAt, null, "网站无法访问"),
          https: status("down", checkedAt, null, "HTTPS 连接失败"),
          cloudflare: status("unknown", checkedAt, null, "暂时无法确认 Cloudflare 状态"),
          latestDeploymentAt: null,
        };
      } finally {
        clearTimeout(timeout);
        parentSignal?.removeEventListener("abort", abort);
      }
    },
  };
}
