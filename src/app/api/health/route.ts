import { NextResponse } from "next/server";
import { isIdentityStoreAvailable } from "@/modules/identity/server";

export async function GET() {
  try {
    if (!(await isIdentityStoreAvailable())) throw new Error("Identity database unavailable");
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
