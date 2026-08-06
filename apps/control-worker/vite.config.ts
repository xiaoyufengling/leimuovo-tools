import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

function sendJson(response: ServerResponse, status: number, value: unknown, cookies?: string[]): void {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (cookies) response.setHeader("Set-Cookie", cookies);
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function developmentControlApi(): Plugin {
  return {
    name: "xiaoyu-control-development-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname === "/control" || pathname === "/control/") {
          request.url = "/control/control/index.html";
          return next();
        }
        if (!pathname.startsWith("/api/control/")) return next();
        const authenticated = request.headers.cookie?.split(";").some((value) => value.trim() === "dev_control_session=1") ?? false;

        if (pathname === "/api/control/session" && request.method === "GET") {
          return sendJson(response, 200, { authenticated, accessEmail: "xiaoyuqaq69@gmail.com" });
        }
        if (pathname === "/api/control/login" && request.method === "POST") {
          const body = await readBody(request);
          if (typeof body.username !== "string" || !body.username || typeof body.password !== "string" || !body.password) {
            return sendJson(response, 401, { error: { code: "INVALID_CREDENTIALS", message: "用户名或密码不正确" } });
          }
          return sendJson(response, 200, { authenticated: true, accessEmail: "xiaoyuqaq69@gmail.com" }, [
            "dev_control_session=1; Path=/; SameSite=Strict",
            "control_hint=1; Path=/; SameSite=Strict",
          ]);
        }
        if (pathname === "/api/control/logout" && request.method === "POST") {
          return sendJson(response, 200, { authenticated: false, accessLogoutUrl: "/control/" }, [
            "dev_control_session=; Max-Age=0; Path=/; SameSite=Strict",
            "control_hint=; Max-Age=0; Path=/; SameSite=Strict",
          ]);
        }
        if (pathname === "/api/control/status" && request.method === "GET") {
          if (!authenticated) return sendJson(response, 401, { error: { code: "AUTHENTICATION_REQUIRED", message: "请先登录" } });
          const checkedAt = new Date().toISOString();
          const up = (message: string) => ({ state: "up", checkedAt, latencyMs: 36, stale: false, message });
          const pending = (message: string) => ({ state: "not_configured", checkedAt: null, latencyMs: null, stale: false, message });
          return sendJson(response, 200, {
            generatedAt: checkedAt,
            website: {
              site: up("网站可用"),
              https: up("HTTPS 正常"),
              cloudflare: up("Cloudflare 正常"),
              latestDeploymentAt: null,
            },
            vps: { ...pending("VPS 检测尚未配置"), metrics: { cpuPercent: null, memoryPercent: null, diskPercent: null } },
            devices: [
              { id: "home-pc", name: "家里电脑", status: pending("尚未配置") },
              { id: "moonlight-host", name: "Moonlight 主机", status: pending("尚未配置") },
              { id: "nas", name: "NAS", status: pending("尚未配置") },
            ],
          });
        }
        return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "接口不存在" } });
      });
    },
  };
}

export default defineConfig({
  base: "/control/",
  publicDir: "public",
  plugins: [developmentControlApi()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "control/index.html"),
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
