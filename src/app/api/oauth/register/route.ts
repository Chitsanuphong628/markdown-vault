import { NextResponse } from "next/server";
import { registerDynamicClient, type ClientRegistrationInput } from "@/lib/mcp/oauth";
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
    return NextResponse.json({ error: "MCP is not enabled" }, { status: 503, headers: CORS_HEADERS });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  if (!(await enforceAuthRateLimit(`oauth-register:${ip}`))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: CORS_HEADERS });
  }

  let body: ClientRegistrationInput = {};
  try {
    body = (await request.json()) as ClientRegistrationInput;
  } catch {
    // Allow empty body registration with defaults
  }

  const clientInfo = registerDynamicClient(body);
  return NextResponse.json(clientInfo, { status: 201, headers: CORS_HEADERS });
}
