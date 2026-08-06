import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { AccessIdentity } from "./app";

export interface AccessConfig {
  teamDomain: string;
  audience: string;
  allowedEmail: string;
}

export type AccessVerifier = (request: Request) => Promise<AccessIdentity | null>;

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function normalizeTeamDomain(value: string): string {
  return value.replace(/^https?:\/\//u, "").replace(/\/+$/u, "");
}

function remoteKeySet(teamDomain: string): JWTVerifyGetKey {
  const existing = remoteKeySets.get(teamDomain);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
  remoteKeySets.set(teamDomain, created);
  return created;
}

export function createAccessVerifier(
  config: AccessConfig,
  keyResolver?: JWTVerifyGetKey,
): AccessVerifier {
  const teamDomain = normalizeTeamDomain(config.teamDomain);
  const issuer = `https://${teamDomain}`;
  const keys = keyResolver ?? remoteKeySet(teamDomain);
  const audiences = config.audience.split(",").map((value) => value.trim()).filter(Boolean);

  return async (request) => {
    const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!assertion) return null;

    try {
      const { payload } = await jwtVerify(assertion, keys, {
        issuer,
        audience: audiences,
        algorithms: ["RS256"],
      });
      if (
        typeof payload.sub !== "string"
        || typeof payload.email !== "string"
        || payload.email.toLowerCase() !== config.allowedEmail.toLowerCase()
      ) return null;
      return { subject: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  };
}
