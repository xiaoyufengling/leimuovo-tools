import { describe, expect, it } from "vitest";
import worker from "../src/worker";

function environment(authMode?: string, counterFetch: (request: Request) => Promise<Response> = async () => new Response("{}")) {
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
    LAB_PET_COUNTER: {
      idFromName: () => ({ toString: () => "lab-counter" }),
      get: () => ({ fetch: counterFetch }),
    },
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

describe("public laboratory pet counter", () => {
  const visitor = "xyg_8d12f001-650c-4f47-99df-5dc6b2d518f0";

  it("reads the anonymous visitor snapshot without requiring control authentication", async () => {
    let forwardedUrl = "";
    const response = await worker.fetch(
      new Request(`https://leimuovo.com/api/lab/pets?visitor=${visitor}`),
      environment(undefined, async (request) => {
        forwardedUrl = request.url;
        return new Response(JSON.stringify({ visitor: { label: "冰蓝小鱼 · 18F0", count: 3 }, totalPets: 9, participantCount: 2, leaders: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    expect(response.status).toBe(200);
    expect(forwardedUrl).toContain(encodeURIComponent(visitor));
    expect(await response.json()).toMatchObject({ totalPets: 9, visitor: { count: 3 } });
  });

  it("increments only same-origin JSON requests", async () => {
    let forwardedMethod = "";
    const env = environment(undefined, async (request) => {
      forwardedMethod = request.method;
      return new Response(JSON.stringify({ visitor: { label: "冰蓝小鱼 · 18F0", count: 4 }, totalPets: 10, participantCount: 2, leaders: [] }));
    });
    const response = await worker.fetch(
      new Request("https://leimuovo.com/api/lab/pets", {
        method: "POST",
        headers: { Origin: "https://leimuovo.com", "Content-Type": "application/json" },
        body: JSON.stringify({ visitor }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(forwardedMethod).toBe("POST");

    const forbidden = await worker.fetch(
      new Request("https://leimuovo.com/api/lab/pets", {
        method: "POST",
        headers: { Origin: "https://example.com", "Content-Type": "application/json" },
        body: JSON.stringify({ visitor }),
      }),
      env,
    );
    expect(forbidden.status).toBe(403);
  });
});
