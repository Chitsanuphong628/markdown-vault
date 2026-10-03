import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { getSupabaseAdmin } from "@/platform/server";

export async function GET() {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ready: false }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ ready: false }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    const checks = await Promise.all([
      admin.from("McpCredential").select("id, createdAt, expiresAt, revokedAt").limit(1),
      admin.from("McpOAuthClient").select("clientId, clientName, redirectUris, createdAt").limit(1),
      admin.from("McpOAuthCode").select("jti, expiresAt").limit(1),
    ]);
    if (checks.some(({ error }) => error)) {
      return NextResponse.json({ ready: false }, { status: 503 });
    }
    return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
