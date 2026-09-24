import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createMcpCredential, listMcpCredentials, revokeMcpCredential } from "@/lib/mcp/credentials";
import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/security";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ credentials: await listMcpCredentials(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Credential storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (process.env.ENABLE_MCP !== "true") return NextResponse.json({ error: "MCP is not enabled" }, { status: 503 });
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first" }, { status: 403 });
  if (!(await enforceAuthRateLimit(`mcp-key:${user.id}`))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const credential = await createMcpCredential(user.id);
    return NextResponse.json(credential, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Credential storage unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credential ID" }, { status: 400 });
  try {
    const revoked = await revokeMcpCredential(user.id, parsed.data.id);
    return NextResponse.json({ revoked }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Credential storage unavailable" }, { status: 503 });
  }
}
