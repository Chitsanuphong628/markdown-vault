import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { issueAuthorizationCode } from "@/lib/mcp/oauth";
import { rejectCrossOrigin } from "@/lib/security";

const AuthorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  code_challenge: z.string().min(1),
  code_challenge_method: z.string().optional().default("S256"),
  state: z.string().optional(),
  scope: z.string().optional().default("mcp"),
  decision: z.enum(["allow", "deny"]),
});

export async function POST(request: Request) {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ error: "MCP is not enabled" }, { status: 503 });
  }

  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: "Please verify your email first" }, { status: 403 });
  }

  const parsed = AuthorizeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid authorization parameters" }, { status: 400 });
  }

  const { client_id, redirect_uri, code_challenge, code_challenge_method, state, scope, decision } = parsed.data;

  if (code_challenge_method !== "S256") {
    return NextResponse.json({ error: "Only S256 PKCE challenge method is supported" }, { status: 400 });
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(redirect_uri);
  } catch {
    return NextResponse.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  if (decision === "deny") {
    callbackUrl.searchParams.set("error", "access_denied");
    if (state) callbackUrl.searchParams.set("state", state);
    return NextResponse.json({ redirectUrl: callbackUrl.toString() });
  }

  const code = issueAuthorizationCode({
    userId: user.id,
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    scope,
  });

  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.json({ redirectUrl: callbackUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
}
