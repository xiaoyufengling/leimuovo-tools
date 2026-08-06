import type { ThrottleRecord } from "./rate-limit";
import { createAuthenticationVerifier } from "./authentication";
import { createControlApp, type LoginThrottle as LoginThrottlePort } from "./app";
import { createLoginThrottle } from "./rate-limit";
import { createWebsiteStatusProvider } from "./website";

interface Env {
  ASSETS: Fetcher;
  LOGIN_THROTTLE: DurableObjectNamespace;
  CONTROL_USERNAME: string;
  CONTROL_PASSWORD_HASH: string;
  CONTROL_SESSION_SECRET: string;
  CONTROL_AUTH_MODE?: string;
  CONTROL_ACCESS_TEAM_DOMAIN?: string;
  CONTROL_ACCESS_AUD?: string;
  CONTROL_ALLOWED_EMAIL: string;
  CONTROL_SITE_ORIGIN: string;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing Worker binding: ${name}`);
  return value;
}

async function opaqueKey(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`login-throttle:${value}`)));
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function createDurableThrottle(env: Env): LoginThrottlePort {
  async function call(key: string, action: "check" | "failure" | "success") {
    const safeKey = await opaqueKey(key, env.CONTROL_SESSION_SECRET);
    const id = env.LOGIN_THROTTLE.idFromName(safeKey);
    return env.LOGIN_THROTTLE.get(id).fetch(`https://login-throttle/${action}`, { method: "POST" });
  }

  return {
    async check(key) {
      const response = await call(key, "check");
      if (!response.ok) return { allowed: false, retryAfterSeconds: 60 };
      return response.json<{ allowed: boolean; retryAfterSeconds: number }>();
    },
    async failure(key) {
      const response = await call(key, "failure");
      if (!response.ok) throw new Error("Login throttle rejected the failure update");
    },
    async success(key) {
      const response = await call(key, "success");
      if (!response.ok) throw new Error("Login throttle rejected the success update");
    },
  };
}

function productionApp(env: Env) {
  const siteOrigin = required(env.CONTROL_SITE_ORIGIN, "CONTROL_SITE_ORIGIN");
  const authMode = required(env.CONTROL_AUTH_MODE, "CONTROL_AUTH_MODE");
  return createControlApp({
    config: {
      username: required(env.CONTROL_USERNAME, "CONTROL_USERNAME"),
      passwordHash: required(env.CONTROL_PASSWORD_HASH, "CONTROL_PASSWORD_HASH"),
      sessionSecret: required(env.CONTROL_SESSION_SECRET, "CONTROL_SESSION_SECRET"),
      siteOrigin,
      logoutUrl: authMode === "cloudflare-access" ? "/cdn-cgi/access/logout" : "/",
    },
    verifyAccess: createAuthenticationVerifier({
      mode: authMode,
      teamDomain: env.CONTROL_ACCESS_TEAM_DOMAIN,
      audience: env.CONTROL_ACCESS_AUD,
      allowedEmail: env.CONTROL_ALLOWED_EMAIL,
    }),
    throttle: createDurableThrottle(env),
    website: createWebsiteStatusProvider({ targetUrl: `${siteOrigin}/` }),
    assets: env.ASSETS,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await productionApp(env).fetch(request);
    } catch {
      return new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "控制中心暂时不可用" } }), {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;

export class LoginThrottle {
  constructor(private readonly state: DurableObjectState) {}

  private storage() {
    return {
      get: () => this.state.storage.get<ThrottleRecord>("state"),
      put: async (value: ThrottleRecord) => {
        await this.state.storage.put("state", value);
        const lastFailure = value.failures.at(-1);
        const cleanupAt = value.lockedUntil ?? (lastFailure ? lastFailure + 10 * 60 * 1_000 + 1 : null);
        if (cleanupAt) await this.state.storage.setAlarm(cleanupAt);
      },
      clear: async () => {
        await this.state.storage.delete("state");
        await this.state.storage.deleteAlarm();
      },
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const action = new URL(request.url).pathname.slice(1);
    const throttle = createLoginThrottle(this.storage());
    if (action === "check") return Response.json(await throttle.check());
    if (action === "failure") {
      await throttle.failure();
      return new Response(null, { status: 204 });
    }
    if (action === "success") {
      await throttle.success();
      return new Response(null, { status: 204 });
    }
    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}
