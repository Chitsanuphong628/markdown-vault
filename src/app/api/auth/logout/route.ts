import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/security";

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("token");
  return response;
}
