import { describe, expect, it } from "vitest";
import { createLoginThrottle, type LoginThrottleStorage, type ThrottleRecord } from "../src/rate-limit";

function memoryStorage(): LoginThrottleStorage & { value: ThrottleRecord | undefined } {
  return {
    value: undefined,
    async get() { return this.value; },
    async put(value) { this.value = value; },
    async clear() { this.value = undefined; },
  };
}

describe("login throttle", () => {
  it("locks for fifteen minutes after five failures in ten minutes", async () => {
    let now = Date.UTC(2026, 7, 6, 9, 30, 0);
    const throttle = createLoginThrottle(memoryStorage(), () => now);

    for (let attempt = 0; attempt < 5; attempt += 1) await throttle.failure();

    await expect(throttle.check()).resolves.toEqual({ allowed: false, retryAfterSeconds: 900 });
    now += 15 * 60 * 1_000 + 1;
    await expect(throttle.check()).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("clears prior failures after a successful login", async () => {
    const storage = memoryStorage();
    const throttle = createLoginThrottle(storage, () => Date.UTC(2026, 7, 6, 9, 30, 0));

    await throttle.failure();
    await throttle.failure();
    await throttle.success();

    expect(storage.value).toBeUndefined();
    await expect(throttle.check()).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
