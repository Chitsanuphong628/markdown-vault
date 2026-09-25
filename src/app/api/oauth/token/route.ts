import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/mcp/oauth";
import { enforceAuthRateLimit } from "@/lib/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ error: "mcp_disabled", error_description: "MCP is not enabled" }, { status: 503, headers: CORS_HEADERS });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  if (!(await enforceAuthRateLimit(`oauth-token:${ip}`))) {
    return NextResponse.json({ error: "slow_down", error_description: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
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
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }

  if (grantType !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type", error_description: "Only authorization_code grant type is supported" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!code || !redirectUri || !codeVerifier) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required parameters: code, redirect_uri, or code_verifier" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const tokenResponse = await exchangeCodeForToken({
      code,
      clientId: clientId || undefined,
      redirectUri,
      codeVerifier,
    });

    return NextResponse.json(tokenResponse, { status: 200, headers: CORS_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.json(
      { error: "invalid_grant", error_description: message },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
