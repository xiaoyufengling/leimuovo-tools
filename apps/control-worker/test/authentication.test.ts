import { describe, expect, it } from "vitest";
import { createAuthenticationVerifier } from "../src/authentication";

describe("control authentication mode", () => {
  it("provides the configured owner identity in explicit password-only mode", async () => {
    const verify = createAuthenticationVerifier({
      mode: "password-only",
      allowedEmail: "xiaoyuqaq69@gmail.com",
      teamDomain: undefined,
      audience: undefined,
    });

    await expect(verify(new Request("https://leimuovo.com/control/"))).resolves.toEqual({
      subject: "password-only:xiaoyuqaq69@gmail.com",
      email: "xiaoyuqaq69@gmail.com",
    });
  });

  it("keeps verified JWT enforcement in explicit cloudflare-access mode", async () => {
    const verify = createAuthenticationVerifier({
      mode: "cloudflare-access",
      allowedEmail: "xiaoyuqaq69@gmail.com",
      teamDomain: "xiaoyu.cloudflareaccess.com",
      audience: "control-audience",
    });

    await expect(verify(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Authenticated-User-Email": "xiaoyuqaq69@gmail.com" },
    }))).resolves.toBeNull();
  });

  it("rejects a missing or unknown mode instead of silently bypassing outer auth", () => {
    expect(() => createAuthenticationVerifier({
      mode: undefined,
      allowedEmail: "xiaoyuqaq69@gmail.com",
      teamDomain: undefined,
      audience: undefined,
    })).toThrow(/CONTROL_AUTH_MODE/iu);
    expect(() => createAuthenticationVerifier({
      mode: "anything-else",
      allowedEmail: "xiaoyuqaq69@gmail.com",
      teamDomain: undefined,
      audience: undefined,
    })).toThrow(/CONTROL_AUTH_MODE/iu);
  });
});
