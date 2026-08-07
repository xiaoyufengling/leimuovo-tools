import { describe, expect, it } from "vitest";
import worker from "../src/worker";

function environment(authMode?: string) {
  return {
    ASSETS: {
      fetch: async () => new Response("<main>小鱼控制中心</main>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    },
    CONTROL_USERNAME: "re0leimu520",
    CONTROL_PASSWORD_HASH: "pbkdf2-sha256$600000$salt$digest",
    CONTROL_SESSION_SECRET: "a-session-secret-that-is-long-enough",
    CONTROL_ALLOWED_EMAIL: "xiaoyuqaq69@gmail.com",
    CONTROL_SITE_ORIGIN: "https://leimuovo.com",
    ...(authMode === undefined ? {} : { CONTROL_AUTH_MODE: authMode }),
  } as never;
}

describe("production control worker authentication configuration", () => {
  it("serves the login page when password-only mode is explicit", async () => {
    const response = await worker.fetch(
      new Request("https://leimuovo.com/control/"),
      environment("password-only"),
    );

    expect(response.status).toBe(200);
  });

  it("fails closed when the authentication mode is missing", async () => {
    const response = await worker.fetch(
      new Request("https://leimuovo.com/control/"),
      environment(),
    );

    expect(response.status).toBe(500);
  });

  it("temporarily locks repeated failures without a stateful Cloudflare binding", async () => {
    const request = () => new Request("https://leimuovo.com/api/control/login", {
      method: "POST",
      headers: { Origin: "https://leimuovo.com", "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrong", passwordProof: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }),
    });
    const env = environment("password-only");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await worker.fetch(request(), env);
      expect(response.status).toBe(401);
    }

    const response = await worker.fetch(request(), env);
    expect(response.status).toBe(429);
  });
});
