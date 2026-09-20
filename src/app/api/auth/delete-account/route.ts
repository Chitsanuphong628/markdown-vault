import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { cookies } from "next/headers";

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Delete all Notes of this user
    await supabaseAdmin.from("Note").delete().eq("userId", user.id);

    // 2. Delete all Folders of this user
    await supabaseAdmin.from("Folder").delete().eq("userId", user.id);

    // 3. Delete user record
    const { error: deleteUserError } = await supabaseAdmin
      .from("User")
      .delete()
      .eq("id", user.id);

    if (deleteUserError) {
      throw new Error(deleteUserError.message);
    }

    // 4. Clear auth session cookie
    const cookieStore = await cookies();
    cookieStore.delete("token");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account deletion failed:", error);
    return NextResponse.json({ error: error.message || "Failed to delete account" }, { status: 500 });
  }
}
