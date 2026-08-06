import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  PASSWORD_HASH_ITERATIONS,
  verifyPassword,
  verifySessionToken,
} from "../src/index";

describe("control authentication", () => {
  it("accepts the original password without storing it in the encoded hash", async () => {
    const encoded = await hashPassword("a deliberately long private password");

    expect(encoded).toContain(`pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$`);
    expect(encoded).not.toContain("a deliberately long private password");
    await expect(verifyPassword("a deliberately long private password", encoded)).resolves.toBe(true);
    await expect(verifyPassword("a different password", encoded)).resolves.toBe(false);
  });

  it("rejects malformed password hashes instead of throwing", async () => {
    await expect(verifyPassword("password", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("issues a session bound to the verified Access identity", async () => {
    const now = Date.UTC(2026, 7, 6, 8, 0, 0);
    const token = await createSessionToken(
      { subject: "access-user-id", email: "xiaoyuqaq69@gmail.com" },
      "a-session-secret-that-is-long-enough",
      now,
    );

    await expect(
      verifySessionToken(token, "a-session-secret-that-is-long-enough", "xiaoyuqaq69@gmail.com", now + 1_000),
    ).resolves.toMatchObject({ subject: "access-user-id", email: "xiaoyuqaq69@gmail.com" });
    await expect(
      verifySessionToken(token, "a-session-secret-that-is-long-enough", "someone@example.com", now + 1_000),
    ).resolves.toBeNull();
  });

  it("rejects expired and tampered sessions", async () => {
    const now = Date.UTC(2026, 7, 6, 8, 0, 0);
    const token = await createSessionToken(
      { subject: "access-user-id", email: "xiaoyuqaq69@gmail.com" },
      "a-session-secret-that-is-long-enough",
      now,
    );
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(
      verifySessionToken(token, "a-session-secret-that-is-long-enough", "xiaoyuqaq69@gmail.com", now + 43_200_001),
    ).resolves.toBeNull();
    await expect(
      verifySessionToken(tampered, "a-session-secret-that-is-long-enough", "xiaoyuqaq69@gmail.com", now + 1_000),
    ).resolves.toBeNull();
  });
});
