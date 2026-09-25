import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { type OAuthMetadata } from "@modelcontextprotocol/server";
import { getWebJwtSecret } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createMcpCredential } from "./credentials";

const AUTH_CODE_LIFETIME_SECONDS = 300; // 5 minutes
const AUTH_CODE_ISSUER = "nota-mcp-oauth";
const AUTH_CODE_AUDIENCE = "nota-mcp-oauth";

export class OAuthRequestError extends Error {}

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

export interface OAuthStore {
  saveClient(client: RegisteredClientInfo): Promise<void>;
  findClient(clientId: string): Promise<RegisteredClientInfo | null>;
  saveCode(jti: string, expiresAt: string): Promise<void>;
  consumeCode(jti: string): Promise<boolean>;
}

const supabaseOAuthStore: OAuthStore = {
  async saveClient(client) {
    const { error } = await getSupabaseAdmin().from("McpOAuthClient").insert({
      clientId: client.client_id,
      clientName: client.client_name,
      redirectUris: client.redirect_uris,
    });
    if (error) throw new Error("Could not register OAuth client");
  },
  async findClient(clientId) {
    const { data, error } = await getSupabaseAdmin().from("McpOAuthClient")
      .select("clientId, clientName, redirectUris, createdAt")
      .eq("clientId", clientId).maybeSingle();
    if (error) throw new Error("Could not load OAuth client");
    if (!data) return null;
    return {
      client_id: data.clientId,
      client_id_issued_at: Math.floor(Date.parse(data.createdAt) / 1000),
      client_name: data.clientName,
      redirect_uris: data.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    };
  },
  async saveCode(jti, expiresAt) {
    const admin = getSupabaseAdmin();
    const { error: cleanupError } = await admin.from("McpOAuthCode")
      .delete().lt("expiresAt", new Date().toISOString());
    if (cleanupError) throw new Error("Could not prepare authorization code");
    const { error } = await admin.from("McpOAuthCode").insert({ jti, expiresAt });
    if (error) throw new Error("Could not issue authorization code");
  },
  async consumeCode(jti) {
    // A single DELETE ... RETURNING is atomic across all server instances.
    const { data, error } = await getSupabaseAdmin().from("McpOAuthCode")
      .delete().eq("jti", jti).gt("expiresAt", new Date().toISOString())
      .select("jti").maybeSingle();
    if (error) throw new Error("Could not redeem authorization code");
    return Boolean(data);
  },
};

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
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
    || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) return false;
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
interface IssueAuthorizationCodeParams {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
}

interface ExchangeCodeParams {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

function validRedirectUri(value: string): boolean {
  try {
    const uri = new URL(value);
    if (!uri.hostname || uri.hash || uri.username || uri.password) return false;
    if (uri.protocol === "https:") return true;
    if (uri.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname);
    return !["file:", "javascript:", "data:"].includes(uri.protocol);
  } catch {
    return false;
  }
}

export function createOAuthService(
  store: OAuthStore,
  issueCredential: (userId: string) => Promise<{ token: string }> = createMcpCredential,
) {
  return {
    async registerDynamicClient(input: ClientRegistrationInput): Promise<RegisteredClientInfo> {
      if (!input || !Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0
        || !input.redirect_uris.every(uri => typeof uri === "string" && validRedirectUri(uri))
        || (input.grant_types && (!Array.isArray(input.grant_types) || input.grant_types.some(type => type !== "authorization_code")))
        || (input.response_types && (!Array.isArray(input.response_types) || input.response_types.some(type => type !== "code")))) {
        throw new OAuthRequestError("Invalid client metadata or redirect_uris");
      }
      const rawName = typeof input.client_name === "string" ? input.client_name.trim() : "AI Assistant";
      const sanitizedName = rawName.normalize("NFKC")
        .replace(/[^\p{L}\p{M}\p{N}\s._-]/gu, "").trim().slice(0, 80).trim() || "AI Client";
      const slug = sanitizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
      const client: RegisteredClientInfo = {
        client_id: `nota_${slug}_${crypto.randomBytes(12).toString("hex")}`,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: sanitizedName,
        redirect_uris: [...new Set(input.redirect_uris)],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      };
      await store.saveClient(client);
      return client;
    },
    findClient: (clientId: string) => store.findClient(clientId),
    async issueAuthorizationCode(params: IssueAuthorizationCodeParams): Promise<string> {
      const client = await store.findClient(params.clientId);
      if (!client) throw new OAuthRequestError("Unknown client_id");
      if (!client.redirect_uris.includes(params.redirectUri)) throw new OAuthRequestError("redirect_uri is not registered for client_id");
      if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new OAuthRequestError("Invalid code_challenge");
      if (params.scope && params.scope !== "mcp") throw new OAuthRequestError("Unsupported scope");
      const jti = crypto.randomUUID();
      const payload: AuthCodeClaims = {
        typ: "mcp_auth_code", sub: params.userId, client_id: params.clientId,
        redirect_uri: params.redirectUri, code_challenge: params.codeChallenge,
        code_challenge_method: "S256", scope: "mcp", jti,
      };
      const code = jwt.sign(payload, getWebJwtSecret(), {
        expiresIn: AUTH_CODE_LIFETIME_SECONDS,
        issuer: AUTH_CODE_ISSUER, audience: AUTH_CODE_AUDIENCE,
      });
      await store.saveCode(jti, new Date(Date.now() + AUTH_CODE_LIFETIME_SECONDS * 1000).toISOString());
      return code;
    },
    async exchangeCodeForToken(params: ExchangeCodeParams): Promise<{
      access_token: string; token_type: "Bearer"; expires_in: number; scope: string;
    }> {
      let claims: AuthCodeClaims;
      try {
        claims = jwt.verify(params.code, getWebJwtSecret(), {
          issuer: AUTH_CODE_ISSUER, audience: AUTH_CODE_AUDIENCE,
        }) as AuthCodeClaims;
      } catch {
        throw new OAuthRequestError("Invalid or expired authorization code");
      }
      if (claims.typ !== "mcp_auth_code" || !claims.jti) throw new OAuthRequestError("Invalid authorization code type");
      if (!params.clientId || claims.client_id !== params.clientId) throw new OAuthRequestError("client_id mismatch");
      if (claims.redirect_uri !== params.redirectUri) throw new OAuthRequestError("redirect_uri mismatch");
      if (!verifyPkce(params.codeVerifier, claims.code_challenge)) throw new OAuthRequestError("Invalid code_verifier (PKCE verification failed)");
      if (!(await store.consumeCode(claims.jti))) throw new OAuthRequestError("Authorization code has already been used");
      const credential = await issueCredential(claims.sub);
      return { access_token: credential.token, token_type: "Bearer",
        expires_in: 90 * 24 * 60 * 60, scope: claims.scope };
    },
  };
}

const nativeOAuth = createOAuthService(supabaseOAuthStore);
export const registerDynamicClient = nativeOAuth.registerDynamicClient;
export const findRegisteredClient = nativeOAuth.findClient;
export const issueAuthorizationCode = nativeOAuth.issueAuthorizationCode;
export const exchangeCodeForToken = nativeOAuth.exchangeCodeForToken;
