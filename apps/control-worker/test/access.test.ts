import { describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createAccessVerifier } from "../src/access";

async function fixtureToken(overrides: { email?: string; audience?: string } = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  const token = await new SignJWT({ email: overrides.email ?? "xiaoyuqaq69@gmail.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("access-user")
    .setIssuer("https://xiaoyu.cloudflareaccess.com")
    .setAudience(overrides.audience ?? "control-audience")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { token, keyResolver: createLocalJWKSet({ keys: [publicJwk] }) };
}

describe("Cloudflare Access verifier", () => {
  it("accepts a signed token only for the configured audience and email", async () => {
    const { token, keyResolver } = await fixtureToken();
    const verify = createAccessVerifier({
      teamDomain: "xiaoyu.cloudflareaccess.com",
      audience: "control-audience",
      allowedEmail: "xiaoyuqaq69@gmail.com",
    }, keyResolver);

    await expect(verify(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    }))).resolves.toEqual({ subject: "access-user", email: "xiaoyuqaq69@gmail.com" });
  });

  it("rejects a valid signature with the wrong identity or audience", async () => {
    const wrongIdentity = await fixtureToken({ email: "someone@example.com" });
    const wrongAudience = await fixtureToken({ audience: "another-application" });
    const config = {
      teamDomain: "xiaoyu.cloudflareaccess.com",
      audience: "control-audience",
      allowedEmail: "xiaoyuqaq69@gmail.com",
    };

    await expect(createAccessVerifier(config, wrongIdentity.keyResolver)(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Jwt-Assertion": wrongIdentity.token },
    }))).resolves.toBeNull();
    await expect(createAccessVerifier(config, wrongAudience.keyResolver)(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Jwt-Assertion": wrongAudience.token },
    }))).resolves.toBeNull();
  });

  it("never accepts the unverified email header by itself", async () => {
    const { keyResolver } = await fixtureToken();
    const verify = createAccessVerifier({
      teamDomain: "xiaoyu.cloudflareaccess.com",
      audience: "control-audience",
      allowedEmail: "xiaoyuqaq69@gmail.com",
    }, keyResolver);

    await expect(verify(new Request("https://leimuovo.com/control/", {
      headers: { "Cf-Access-Authenticated-User-Email": "xiaoyuqaq69@gmail.com" },
    }))).resolves.toBeNull();
  });
});
