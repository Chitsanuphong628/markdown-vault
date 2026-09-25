import { NextResponse } from "next/server";
import { exchangeCodeForToken, OAuthRequestError } from "@/lib/mcp/oauth";
import { allowOAuthRequest, OAUTH_CORS_HEADERS } from "@/lib/mcp/oauth-http";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export async function POST(request: Request) {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ error: "mcp_disabled", error_description: "MCP is not enabled" }, { status: 503, headers: OAUTH_CORS_HEADERS });
  }

  if (!(await allowOAuthRequest(request, "token"))) {
    return NextResponse.json({ error: "slow_down", error_description: "Too many requests" }, { status: 429, headers: OAUTH_CORS_HEADERS });
  }

  let grantType = "";
  let code = "";
  let redirectUri = "";
  let clientId = "";
  let codeVerifier = "";

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    grantType = formData.get("grant_type")?.toString() || "";
    code = formData.get("code")?.toString() || "";
    redirectUri = formData.get("redirect_uri")?.toString() || "";
    clientId = formData.get("client_id")?.toString() || "";
    codeVerifier = formData.get("code_verifier")?.toString() || "";
  } else {
    try {
      const json = await request.json();
      grantType = json.grant_type || "";
      code = json.code || "";
      redirectUri = json.redirect_uri || "";
      clientId = json.client_id || "";
      codeVerifier = json.code_verifier || "";
    } catch {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Could not parse request body" },
        { status: 400, headers: OAUTH_CORS_HEADERS }
      );
    }
  }

  if (grantType !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only authorization_code grant type is supported" },
      { status: 400, headers: OAUTH_CORS_HEADERS }
    );
  }

  if (!code || !redirectUri || !codeVerifier || !clientId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters: code, client_id, redirect_uri, or code_verifier" },
      { status: 400, headers: OAUTH_CORS_HEADERS }
    );
  }

  try {
    const tokenResponse = await exchangeCodeForToken({
      code,
      clientId,
      redirectUri,
      codeVerifier,
    });

    return NextResponse.json(tokenResponse, { status: 200, headers: OAUTH_CORS_HEADERS });
  } catch (err: unknown) {
    const invalid = err instanceof OAuthRequestError;
    return NextResponse.json(
      { error: invalid ? "invalid_grant" : "server_error",
        error_description: invalid ? err.message : "Token service unavailable" },
      { status: invalid ? 400 : 503, headers: OAUTH_CORS_HEADERS }
    );
  }
}
