import { createMcpHandler, getOAuthProtectedResourceMetadataUrl, oauthMetadataResponse, originValidationResponse,
  requireBearerAuth, OAuthError, OAuthErrorCode, type AuthInfo, type OAuthMetadata } from "@modelcontextprotocol/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { isTrustedAppUrl } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createNotaMcpServer } from "./server";
import { verifyMcpCredential } from "./credentials";

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("MCP principal is required");
  return createNotaMcpServer(userId);
}, { legacy: "stateless", maxRequestBodySize: 2_000_000 });

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getEffectiveRequestUrl(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    try {
      const parsed = new URL(request.url);
      return `${forwardedProto}://${forwardedHost}${parsed.pathname}${parsed.search}`;
    } catch {
      return `${forwardedProto}://${forwardedHost}/api/mcp`;
    }
  }
  return request.url;
}

function resourceUrl(requestUrl?: string): URL {
  if (!requestUrl || !isTrustedAppUrl(requestUrl)) throw new Error("Untrusted MCP host");
  const parsed = new URL("/api/mcp", requestUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }
  return parsed;
}

export function oauthMetadata(): OAuthMetadata | null {
  const issuer = process.env.MCP_OAUTH_ISSUER;
  const authorizationEndpoint = process.env.MCP_OAUTH_AUTHORIZATION_ENDPOINT;
  const tokenEndpoint = process.env.MCP_OAUTH_TOKEN_ENDPOINT;
  if (!issuer || !authorizationEndpoint || !tokenEndpoint || !process.env.MCP_OAUTH_JWKS_URL) return null;
  if (![issuer, authorizationEndpoint, tokenEndpoint, process.env.MCP_OAUTH_JWKS_URL]
    .every(value => value.startsWith("https://"))) return null;
  return { issuer, authorization_endpoint: authorizationEndpoint, token_endpoint: tokenEndpoint,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"], scopes_supported: ["mcp"] };
}

async function authInfoForToken(token: string, resource: URL): Promise<AuthInfo> {
  const pat = await verifyMcpCredential(token);
  if (pat) return { token, clientId: pat.credentialId, scopes: ["mcp"], expiresAt: pat.expiresAt,
    resource, extra: { userId: pat.userId } };

  const metadata = oauthMetadata();
  const jwksUrl = process.env.MCP_OAUTH_JWKS_URL;
  if (!metadata || !jwksUrl || !/^https:\/\//.test(jwksUrl)) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
  jwks ??= createRemoteJWKSet(new URL(jwksUrl));
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: metadata.issuer, audience: resource.href }));
  } catch {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
  }
  const userId = payload.sub;
  const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
  if (!userId || !payload.exp || !scopes.includes("mcp")) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
  const { data: user, error } = await getSupabaseAdmin().from("User").select("id, emailVerified")
    .eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!user || user.emailVerified !== true) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
  return { token, clientId: typeof payload.client_id === "string" ? payload.client_id : "oauth-client",
    scopes, expiresAt: payload.exp, resource, extra: { userId } };
}

export async function serveMcpHttp(request: Request): Promise<Response> {
  if (process.env.ENABLE_MCP !== "true") return Response.json({ error: "MCP disabled" }, { status: 503 });
  const effectiveUrl = getEffectiveRequestUrl(request);
  if (!isTrustedAppUrl(effectiveUrl)) return Response.json({ error: "Invalid host" }, { status: 403 });
  const expected = resourceUrl(effectiveUrl);
  const originError = originValidationResponse(request, [expected.hostname]);
  if (originError) return originError;
  const metadata = oauthMetadata();
  const gate = requireBearerAuth({
    verifier: { verifyAccessToken: token => authInfoForToken(token, expected) }, requiredScopes: ["mcp"],
    resourceMetadataUrl: metadata ? getOAuthProtectedResourceMetadataUrl(expected) : undefined,
  });
  const auth = await gate(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}

export function serveMcpOAuthMetadata(request: Request): Response {
  const metadata = oauthMetadata();
  const effectiveUrl = getEffectiveRequestUrl(request);
  if (process.env.ENABLE_MCP !== "true" || !metadata || !isTrustedAppUrl(effectiveUrl)) return new Response(null, { status: 404 });
  return oauthMetadataResponse(request, {
    oauthMetadata: metadata, resourceServerUrl: resourceUrl(effectiveUrl), scopesSupported: ["mcp"], resourceName: "Nota Vault",
  }) ?? new Response(null, { status: 404 });
}
