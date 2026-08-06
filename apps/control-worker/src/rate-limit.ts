const FAILURE_WINDOW_MS = 10 * 60 * 1_000;
const LOCK_DURATION_MS = 15 * 60 * 1_000;
const MAX_FAILURES = 5;

export interface ThrottleRecord {
  failures: number[];
  lockedUntil: number | null;
}

export interface LoginThrottleStorage {
  get(): Promise<ThrottleRecord | undefined>;
  put(value: ThrottleRecord): Promise<void>;
  clear(): Promise<void>;
}

export interface ScopedLoginThrottle {
  check(): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  failure(): Promise<void>;
  success(): Promise<void>;
}

function recentFailures(record: ThrottleRecord | undefined, now: number): number[] {
  return (record?.failures ?? []).filter((failedAt) => failedAt > now - FAILURE_WINDOW_MS);
}

export function createLoginThrottle(
  storage: LoginThrottleStorage,
  now: () => number = Date.now,
): ScopedLoginThrottle {
  return {
    async check() {
      const currentTime = now();
      const record = await storage.get();
      if (record?.lockedUntil && record.lockedUntil > currentTime) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntil - currentTime) / 1_000)),
        };
      }

      const failures = recentFailures(record, currentTime);
      if (failures.length === 0) await storage.clear();
      else if (!record || record.lockedUntil !== null || failures.length !== record.failures.length) {
        await storage.put({ failures, lockedUntil: null });
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },

    async failure() {
      const currentTime = now();
      const record = await storage.get();
      if (record?.lockedUntil && record.lockedUntil > currentTime) return;
      const failures = [...recentFailures(record, currentTime), currentTime];
      await storage.put({
        failures,
        lockedUntil: failures.length >= MAX_FAILURES ? currentTime + LOCK_DURATION_MS : null,
      });
    },

    async success() {
      await storage.clear();
    },
  };
}
