import { NextResponse } from "next/server";
import { getSessionUser, signApiKey } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = signApiKey({ userId: user.id, email: user.email });

    return NextResponse.json({
      success: true,
      apiKey,
    });
  } catch (error: any) {
    console.error("API Key generate error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate API Key" }, { status: 500 });
  }
}
