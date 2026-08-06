import {
  createServerStatusSnapshot,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
  type StatusProvider,
  type WebsiteStatus,
} from "@leimuovo/control-core";

const SESSION_COOKIE = "xiaoyu_control_session";
const HINT_COOKIE = "control_hint";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface AccessIdentity {
  subject: string;
  email: string;
}

export interface ControlConfig {
  username: string;
  passwordHash: string;
  sessionSecret: string;
  siteOrigin: string;
}

export interface LoginThrottle {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  failure(key: string): Promise<void>;
  success(key: string): Promise<void>;
}

export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface ControlAppDependencies {
  config: ControlConfig;
  verifyAccess(request: Request): Promise<AccessIdentity | null>;
  throttle: LoginThrottle;
  website: StatusProvider<WebsiteStatus>;
  assets: AssetFetcher;
  now?: () => number;
  clientAddress?: (request: Request) => string;
}

export interface ControlApp {
  fetch(request: Request): Promise<Response>;
}

interface LoginBody {
  username: string;
  password: string;
}

function controlHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self' https://api4.ipify.org https://api6.ipify.org",
      "font-src 'self'",
      "manifest-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function secureResponse(response: Response): Response {
  const secured = new Response(response.body, response);
  const headers = controlHeaders();
  for (const [name, value] of Object.entries(headers)) secured.headers.set(name, value);
  return secured;
}

function json(value: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const response = new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
  return secureResponse(response);
}

function error(code: string, message: string, status: number, extraHeaders?: HeadersInit): Response {
  return json({ error: { code, message } }, status, extraHeaders);
}

function readCookie(request: Request, name: string): string | null {
  const source = request.headers.get("Cookie");
  if (!source) return null;
  for (const pair of source.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

function hintCookie(): string {
  return `${HINT_COOKIE}=1; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; Secure; SameSite=Strict`;
}

function clearCookie(name: string, httpOnly = false): string {
  return `${name}=; Max-Age=0; Path=/; Secure; ${httpOnly ? "HttpOnly; " : ""}SameSite=Strict`;
}

function appendCookie(response: Response, cookie: string): void {
  response.headers.append("Set-Cookie", cookie);
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return mismatch === 0;
}

async function readLoginBody(request: Request): Promise<LoginBody | null> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  const contentLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
  if (contentLength > 2_048) return null;

  try {
    const source = await request.text();
    if (source.length > 2_048) return null;
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object") return null;
    const body = value as Record<string, unknown>;
    if (
      typeof body.username !== "string"
      || typeof body.password !== "string"
      || body.username.length < 1
      || body.username.length > 128
      || body.password.length < 1
      || body.password.length > 256
    ) return null;
    return { username: body.username, password: body.password };
  } catch {
    return null;
  }
}

async function authenticatedSession(
  request: Request,
  identity: AccessIdentity,
  config: ControlConfig,
  now: number,
) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await verifySessionToken(token, config.sessionSecret, identity.email, now);
  if (!session || session.subject !== identity.subject) return null;
  return session;
}

export function createControlApp(dependencies: ControlAppDependencies): ControlApp {
  const now = dependencies.now ?? Date.now;
  const clientAddress = dependencies.clientAddress
    ?? ((request: Request) => request.headers.get("CF-Connecting-IP") ?? "unknown");

  return {
    async fetch(request) {
      const url = new URL(request.url);
      const isApi = url.pathname.startsWith("/api/control/");
      const isControl = url.pathname === "/control" || url.pathname.startsWith("/control/");
      if (!isApi && !isControl) return secureResponse(new Response("Not found", { status: 404 }));

      const identity = await dependencies.verifyAccess(request);
      if (!identity) {
        return isApi
          ? error("ACCESS_DENIED", "访问被拒绝", 403)
          : secureResponse(new Response("访问被拒绝", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
      }

      if (url.pathname === "/control") {
        return secureResponse(Response.redirect(`${dependencies.config.siteOrigin}/control/`, 308));
      }

      if (url.pathname.startsWith("/control/")) {
        return secureResponse(await dependencies.assets.fetch(request));
      }

      if (url.pathname === "/api/control/session" && request.method === "GET") {
        const session = await authenticatedSession(request, identity, dependencies.config, now());
        return json(session
          ? { authenticated: true, accessEmail: identity.email, expiresAt: new Date(session.expiresAt).toISOString() }
          : { authenticated: false, accessEmail: identity.email });
      }

      if (url.pathname === "/api/control/login" && request.method === "POST") {
        if (request.headers.get("Origin") !== dependencies.config.siteOrigin) {
          return error("INVALID_ORIGIN", "请求来源无效", 403);
        }
        const body = await readLoginBody(request);
        if (!body) return error("INVALID_REQUEST", "登录请求无效", 400);

        const throttleKey = `${identity.subject}:${clientAddress(request)}`;
        const allowance = await dependencies.throttle.check(throttleKey);
        if (!allowance.allowed) {
          return error("TOO_MANY_ATTEMPTS", "尝试次数过多，请稍后再试", 429, {
            "Retry-After": allowance.retryAfterSeconds.toString(),
          });
        }

        const [usernameMatches, passwordMatches] = await Promise.all([
          Promise.resolve(constantTimeStringEqual(body.username, dependencies.config.username)),
          verifyPassword(body.password, dependencies.config.passwordHash),
        ]);
        if (!usernameMatches || !passwordMatches) {
          await dependencies.throttle.failure(throttleKey);
          return error("INVALID_CREDENTIALS", "用户名或密码不正确", 401);
        }

        await dependencies.throttle.success(throttleKey);
        const token = await createSessionToken(identity, dependencies.config.sessionSecret, now());
        const response = json({ authenticated: true, accessEmail: identity.email });
        appendCookie(response, sessionCookie(token));
        appendCookie(response, hintCookie());
        return response;
      }

      if (url.pathname === "/api/control/logout" && request.method === "POST") {
        if (request.headers.get("Origin") !== dependencies.config.siteOrigin) {
          return error("INVALID_ORIGIN", "请求来源无效", 403);
        }
        const response = json({ authenticated: false, accessLogoutUrl: "/cdn-cgi/access/logout" });
        appendCookie(response, clearCookie(SESSION_COOKIE, true));
        appendCookie(response, clearCookie(HINT_COOKIE));
        return response;
      }

      if (url.pathname === "/api/control/status" && request.method === "GET") {
        const session = await authenticatedSession(request, identity, dependencies.config, now());
        if (!session) return error("AUTHENTICATION_REQUIRED", "请先登录", 401);
        const website = await dependencies.website.check(request.signal);
        return json(createServerStatusSnapshot(website, new Date(now()).toISOString()));
      }

      return error("NOT_FOUND", "接口不存在", 404);
    },
  };
}
