import { beforeAll, describe, expect, it } from "vitest";
import {
  derivePasswordProof,
  getPasswordDerivationParameters,
  hashPassword,
  type WebsiteStatus,
} from "@leimuovo/control-core";
import { createControlApp, type AccessIdentity, type ControlAppDependencies } from "../src/app";
import { createAuthenticationVerifier } from "../src/authentication";

const accessIdentity: AccessIdentity = {
  subject: "verified-access-user",
  email: "xiaoyuqaq69@gmail.com",
};

const website: WebsiteStatus = {
  site: { state: "up", checkedAt: "2026-08-06T09:00:00.000Z", latencyMs: 38, stale: false, message: "网站可用" },
  https: { state: "up", checkedAt: "2026-08-06T09:00:00.000Z", latencyMs: 38, stale: false, message: "HTTPS 正常" },
  cloudflare: { state: "up", checkedAt: "2026-08-06T09:00:00.000Z", latencyMs: 38, stale: false, message: "Cloudflare 正常" },
  latestDeploymentAt: null,
};

let passwordHash = "";
let correctPasswordProof = "";
let wrongPasswordProof = "";

beforeAll(async () => {
  passwordHash = await hashPassword("correct horse battery staple");
  const parameters = getPasswordDerivationParameters(passwordHash);
  if (!parameters) throw new Error("Test password hash is invalid");
  correctPasswordProof = await derivePasswordProof("correct horse battery staple", parameters);
  wrongPasswordProof = await derivePasswordProof("wrong password", parameters);
});

function dependencies(): ControlAppDependencies {
  return {
    config: {
      username: "xiaoyu",
      passwordHash,
      sessionSecret: "a-session-secret-that-is-long-enough",
      siteOrigin: "https://leimuovo.com",
      logoutUrl: "/",
    },
    verifyAccess: async (request) => request.headers.get("x-test-access") === "valid" ? accessIdentity : null,
    throttle: {
      check: async () => ({ allowed: true, retryAfterSeconds: 0 }),
      failure: async () => undefined,
      success: async () => undefined,
    },
    website: { check: async () => website },
    assets: {
      fetch: async (request) => new Response(
        new URL(request.url).pathname.endsWith("/403.html") ? "<main>当前身份无法访问</main>" : "<main>小鱼控制中心</main>",
        { headers: { "Content-Type": "text/html" } },
      ),
    },
    now: () => Date.UTC(2026, 7, 6, 9, 0, 0),
    clientAddress: () => "203.0.113.8",
  };
}

function accessHeaders(extra: HeadersInit = {}): Headers {
  return new Headers({ "x-test-access": "valid", ...Object.fromEntries(new Headers(extra)) });
}

describe("control worker HTTP interface", () => {
  it("rejects direct access even when a caller forges the email header", async () => {
    const app = createControlApp(dependencies());
    const response = await app.fetch(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Authenticated-User-Email": "xiaoyuqaq69@gmail.com" },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.text()).resolves.toContain("当前身份无法访问");
  });

  it("allows the explicit password-only mode to show login without exposing status", async () => {
    const app = createControlApp({
      ...dependencies(),
      verifyAccess: createAuthenticationVerifier({
        mode: "password-only",
        allowedEmail: accessIdentity.email,
        teamDomain: undefined,
        audience: undefined,
      }),
    });

    const page = await app.fetch(new Request("https://leimuovo.com/control/"));
    const status = await app.fetch(new Request("https://leimuovo.com/api/control/status"));

    expect(page.status).toBe(200);
    expect(status.status).toBe(401);
  });

  it("reveals the login state but protects status until the inner login succeeds", async () => {
    const app = createControlApp(dependencies());
    const session = await app.fetch(new Request("https://leimuovo.com/api/control/session", { headers: accessHeaders() }));
    const status = await app.fetch(new Request("https://leimuovo.com/api/control/status", { headers: accessHeaders() }));

    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ authenticated: false });
    expect(status.status).toBe(401);
  });

  it("returns browser derivation parameters without exposing the stored digest", async () => {
    const app = createControlApp(dependencies());
    const response = await app.fetch(new Request("https://leimuovo.com/api/control/password-parameters", {
      headers: accessHeaders(),
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("pbkdf2-sha256");
    expect(body).not.toContain(passwordHash.split("$").at(-1));
  });

  it("sets secure cookies after login and returns the status snapshot", async () => {
    const app = createControlApp(dependencies());
    const login = await app.fetch(new Request("https://leimuovo.com/api/control/login", {
      method: "POST",
      headers: accessHeaders({ Origin: "https://leimuovo.com", "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "xiaoyu", passwordProof: correctPasswordProof }),
    }));
    const setCookie = login.headers.get("Set-Cookie") ?? "";
    const sessionCookie = setCookie.match(/xiaoyu_control_session=([^;,]+)/u)?.[1];

    expect(login.status).toBe(200);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("control_hint=1");
    expect(sessionCookie).toBeTruthy();

    const status = await app.fetch(new Request("https://leimuovo.com/api/control/status", {
      headers: accessHeaders({ Cookie: `xiaoyu_control_session=${sessionCookie}` }),
    }));
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({
      website: { site: { state: "up" } },
      vps: { state: "not_configured" },
      devices: [{ id: "home-pc" }, { id: "moonlight-host" }, { id: "nas" }],
    });
  });

  it("returns one generic error for invalid credentials", async () => {
    const app = createControlApp(dependencies());
    const response = await app.fetch(new Request("https://leimuovo.com/api/control/login", {
      method: "POST",
      headers: accessHeaders({ Origin: "https://leimuovo.com", "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "xiaoyu", passwordProof: wrongPasswordProof }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "用户名或密码不正确" },
    });
  });
});
