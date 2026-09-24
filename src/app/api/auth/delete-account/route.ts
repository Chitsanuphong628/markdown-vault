import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser, invalidateSessionUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { rejectCrossOrigin } from "@/lib/security";

export async function DELETE(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error: deleteUserError } = await getSupabaseAdmin()
      .rpc("delete_nota_account", { target_user_id: user.id });

    if (deleteUserError) {
      throw new Error(deleteUserError.message);
    }

    invalidateSessionUser(user.id);

    // 4. Clear auth session cookie
    const cookieStore = await cookies();
    cookieStore.delete("token");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account deletion failed:", error);
    return NextResponse.json({ error: error.message || "Failed to delete account" }, { status: 500 });
  }
}
