import { createAccessVerifier, type AccessVerifier } from "./access";
import type { JWTVerifyGetKey } from "jose";

export interface AuthenticationConfig {
  mode: string | undefined;
  allowedEmail: string | undefined;
  teamDomain: string | undefined;
  audience: string | undefined;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing Worker binding: ${name}`);
  return value;
}

export function createAuthenticationVerifier(config: AuthenticationConfig, keyResolver?: JWTVerifyGetKey): AccessVerifier {
  if (config.mode === "cloudflare-access") {
    return createAccessVerifier({
      teamDomain: required(config.teamDomain, "CONTROL_ACCESS_TEAM_DOMAIN"),
      audience: required(config.audience, "CONTROL_ACCESS_AUD"),
      allowedEmail: required(config.allowedEmail, "CONTROL_ALLOWED_EMAIL"),
    }, keyResolver);
  }

  if (config.mode !== "password-only") {
    throw new Error(`Unsupported CONTROL_AUTH_MODE: ${config.mode ?? "missing"}`);
  }

  const email = required(config.allowedEmail, "CONTROL_ALLOWED_EMAIL").toLowerCase();
  const identity = { subject: `password-only:${email}`, email };
  return async () => identity;
}
