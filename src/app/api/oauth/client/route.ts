import { NextResponse } from "next/server";
import { findRegisteredClient } from "@/lib/mcp/oauth";

export async function GET(request: Request) {
  if (process.env.ENABLE_MCP !== "true") {
    return NextResponse.json({ error: "MCP is not enabled" }, { status: 503 });
  }
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "Missing client_id" }, { status: 400 });

  try {
    const client = await findRegisteredClient(clientId);
    if (!client) return NextResponse.json({ error: "Unknown client_id" }, { status: 404 });
    return NextResponse.json({ client_name: client.client_name, redirect_uris: client.redirect_uris },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Client lookup unavailable" }, { status: 503 });
  }
}
