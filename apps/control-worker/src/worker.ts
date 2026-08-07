import type { ThrottleRecord } from "./rate-limit";
import { createAuthenticationVerifier } from "./authentication";
import { createControlApp, type LoginThrottle as LoginThrottlePort } from "./app";
import { createLoginThrottle } from "./rate-limit";
import { createWebsiteStatusProvider } from "./website";

interface Env {
  ASSETS: Fetcher;
  CONTROL_USERNAME: string;
  CONTROL_PASSWORD_HASH: string;
  CONTROL_SESSION_SECRET: string;
  CONTROL_AUTH_MODE?: string;
  CONTROL_ACCESS_TEAM_DOMAIN?: string;
  CONTROL_ACCESS_AUD?: string;
  CONTROL_ALLOWED_EMAIL: string;
  CONTROL_SITE_ORIGIN: string;
}

const ephemeralThrottleState = new Map<string, ThrottleRecord>();

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

async function scopedEphemeralThrottle(env: Env, key: string) {
  const safeKey = await opaqueKey(key, env.CONTROL_SESSION_SECRET);
  return createLoginThrottle({
    get: async () => ephemeralThrottleState.get(safeKey),
    put: async (value) => { ephemeralThrottleState.set(safeKey, value); },
    clear: async () => { ephemeralThrottleState.delete(safeKey); },
  });
}

function createEphemeralThrottle(env: Env): LoginThrottlePort {
  return {
    async check(key) {
      return (await scopedEphemeralThrottle(env, key)).check();
    },
    async failure(key) {
      await (await scopedEphemeralThrottle(env, key)).failure();
    },
    async success(key) {
      await (await scopedEphemeralThrottle(env, key)).success();
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
    throttle: createEphemeralThrottle(env),
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
