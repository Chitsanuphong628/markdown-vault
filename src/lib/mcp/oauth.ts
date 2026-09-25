import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { type OAuthMetadata } from "@modelcontextprotocol/server";
import { getWebJwtSecret } from "@/lib/env";
import { createMcpCredential } from "./credentials";

const AUTH_CODE_LIFETIME_SECONDS = 300; // 5 minutes
const AUTH_CODE_ISSUER = "nota-mcp-oauth";
const AUTH_CODE_AUDIENCE = "nota-mcp-oauth";

export interface AuthCodeClaims {
  typ: "mcp_auth_code";
  sub: string; // userId
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: "S256";
  scope: string;
  jti: string;
}

export interface ClientRegistrationInput {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}

export interface RegisteredClientInfo {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: string[];
  response_types: string[];
}

// In-memory set of used authorization code JTIs to prevent replay attacks
const consumedAuthCodes = new Set<string>();

export function getNativeOAuthMetadata(baseUrl: string): OAuthMetadata {
  const origin = new URL(baseUrl).origin;
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

/** Verify PKCE code_verifier against code_challenge using SHA256 (RFC 7636) */
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string = "S256"
): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  if (method !== "S256") return false;
  const calculated = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const calculatedBuf = Buffer.from(calculated);
  const challengeBuf = Buffer.from(codeChallenge);
  if (calculatedBuf.length !== challengeBuf.length) return false;
  return crypto.timingSafeEqual(calculatedBuf, challengeBuf);
}

/** Issues a signed 5-minute authorization code */
export function issueAuthorizationCode(params: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const jti = crypto.randomUUID();
  const payload: AuthCodeClaims = {
    typ: "mcp_auth_code",
    sub: params.userId,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    scope: params.scope || "mcp",
    jti,
  };

  return jwt.sign(payload, getWebJwtSecret(), {
    expiresIn: AUTH_CODE_LIFETIME_SECONDS,
    issuer: AUTH_CODE_ISSUER,
    audience: AUTH_CODE_AUDIENCE,
  });
}

/** Validates and consumes an authorization code, exchanging it for an MCP credential */
export async function exchangeCodeForToken(params: {
  code: string;
  clientId?: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ access_token: string; token_type: "Bearer"; expires_in: number; scope: string }> {
  let claims: AuthCodeClaims;
  try {
    claims = jwt.verify(params.code, getWebJwtSecret(), {
      issuer: AUTH_CODE_ISSUER,
      audience: AUTH_CODE_AUDIENCE,
    }) as AuthCodeClaims;
  } catch {
    throw new Error("Invalid or expired authorization code");
  }

  if (claims.typ !== "mcp_auth_code" || !claims.jti) {
    throw new Error("Invalid authorization code type");
  }

  // Replay prevention: check if code has already been consumed
  if (consumedAuthCodes.has(claims.jti)) {
    throw new Error("Authorization code has already been used");
  }
  consumedAuthCodes.add(claims.jti);

  // Self-prune consumed set periodically to prevent memory leaks
  if (consumedAuthCodes.size > 2000) {
    consumedAuthCodes.clear();
  }

  // Validate redirect_uri match
  if (claims.redirect_uri !== params.redirectUri) {
    throw new Error("redirect_uri mismatch");
  }

  // Validate client_id match if provided
  if (params.clientId && claims.client_id !== params.clientId) {
    throw new Error("client_id mismatch");
  }

  // Validate PKCE S256
  if (!verifyPkce(params.codeVerifier, claims.code_challenge)) {
    throw new Error("Invalid code_verifier (PKCE verification failed)");
  }

  // Generate revocable MCP Credential token for the user
  const credential = await createMcpCredential(claims.sub);

  return {
    access_token: credential.token,
    token_type: "Bearer",
    expires_in: 90 * 24 * 60 * 60, // 90 days in seconds
    scope: claims.scope,
  };
}

/** Handles Dynamic Client Registration according to RFC 7591 */
export function registerDynamicClient(input: ClientRegistrationInput): RegisteredClientInfo {
  const rawName = input.client_name?.trim() || "AI Assistant";
  const sanitizedName = rawName.replace(/[^\w\s-]/g, "").slice(0, 50) || "AI Client";
  const slug = sanitizedName.toLowerCase().replace(/\s+/g, "-");
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const clientId = `nota_${slug}_${randomSuffix}`;

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: sanitizedName,
    redirect_uris: input.redirect_uris && input.redirect_uris.length > 0 ? input.redirect_uris : ["http://localhost/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  };
}
