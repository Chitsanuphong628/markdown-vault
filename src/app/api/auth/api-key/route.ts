import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "MCP is unavailable in this release" }, { status: 410 });
}
