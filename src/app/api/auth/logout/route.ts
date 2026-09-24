import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/security";
import { cookies } from "next/headers";
import { verifyToken, invalidateSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.userId) {
      invalidateSessionUser(payload.userId);
    }
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("token");
  return response;
}
