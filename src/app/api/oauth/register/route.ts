import { NextResponse } from "next/server";
import { OAuthRequestError, registerDynamicClient, type ClientRegistrationInput } from "@/lib/mcp/oauth";
import { allowOAuthRequest, OAUTH_CORS_HEADERS } from "@/lib/mcp/oauth-http";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export async function POST(request: Request) {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ error: "MCP is not enabled" }, { status: 503, headers: OAUTH_CORS_HEADERS });
  }

  if (!(await allowOAuthRequest(request, "register"))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: OAUTH_CORS_HEADERS });
  }

  let body: ClientRegistrationInput = {};
  try {
    body = (await request.json()) as ClientRegistrationInput;
  } catch {
    // Allow empty body registration with defaults
  }

  try {
    const clientInfo = await registerDynamicClient(body);
    return NextResponse.json(clientInfo, { status: 201, headers: OAUTH_CORS_HEADERS });
  } catch (error) {
    const invalid = error instanceof OAuthRequestError;
    return NextResponse.json({ error: invalid ? "invalid_client_metadata" : "server_error" },
      { status: invalid ? 400 : 500, headers: OAUTH_CORS_HEADERS });
  }
}
