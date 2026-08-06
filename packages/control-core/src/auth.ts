const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PASSWORD_HASH_ITERATIONS = 600_000;
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1_000;

const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const SESSION_VERSION = 1;

export interface SessionIdentity {
  subject: string;
  email: string;
}

export interface SessionClaims extends SessionIdentity {
  issuedAt: number;
  expiresAt: number;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 16) throw new Error("控制中心密码至少需要 16 个字符");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePassword(password, salt, PASSWORD_HASH_ITERATIONS);
  return [
    PASSWORD_ALGORITHM,
    PASSWORD_HASH_ITERATIONS.toString(),
    encodeBase64Url(salt),
    encodeBase64Url(digest),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationSource, saltSource, digestSource, extra] = encodedHash.split("$");
  if (extra !== undefined || algorithm !== PASSWORD_ALGORITHM || !iterationSource || !saltSource || !digestSource) {
    return false;
  }

  const iterations = Number.parseInt(iterationSource, 10);
  const salt = decodeBase64Url(saltSource);
  const expected = decodeBase64Url(digestSource);
  if (iterations !== PASSWORD_HASH_ITERATIONS || !salt || salt.length < 16 || !expected || expected.length !== 32) {
    return false;
  }

  const actual = await derivePassword(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

async function createHmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createSessionToken(
  identity: SessionIdentity,
  secret: string,
  now = Date.now(),
): Promise<string> {
  if (secret.length < 32) throw new Error("会话密钥至少需要 32 个字符");
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    version: SESSION_VERSION,
    subject: identity.subject,
    email: identity.email,
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  })));
  const signature = encodeBase64Url(await createHmac(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  expectedEmail: string,
  now = Date.now(),
): Promise<SessionClaims | null> {
  const [payloadSource, signatureSource, extra] = token.split(".");
  if (extra !== undefined || !payloadSource || !signatureSource || secret.length < 32) return null;

  const providedSignature = decodeBase64Url(signatureSource);
  if (!providedSignature) return null;
  const expectedSignature = await createHmac(payloadSource, secret);
  if (!constantTimeEqual(providedSignature, expectedSignature)) return null;

  const payloadBytes = decodeBase64Url(payloadSource);
  if (!payloadBytes) return null;

  try {
    const payload: unknown = JSON.parse(decoder.decode(payloadBytes));
    if (!payload || typeof payload !== "object") return null;
    const candidate = payload as Record<string, unknown>;
    if (
      candidate.version !== SESSION_VERSION
      || typeof candidate.subject !== "string"
      || typeof candidate.email !== "string"
      || typeof candidate.issuedAt !== "number"
      || typeof candidate.expiresAt !== "number"
      || candidate.email.toLowerCase() !== expectedEmail.toLowerCase()
      || candidate.expiresAt <= now
      || candidate.issuedAt > now + 5 * 60 * 1_000
      || candidate.expiresAt - candidate.issuedAt !== SESSION_DURATION_MS
    ) {
      return null;
    }

    return {
      subject: candidate.subject,
      email: candidate.email,
      issuedAt: candidate.issuedAt,
      expiresAt: candidate.expiresAt,
    };
  } catch {
    return null;
  }
}
