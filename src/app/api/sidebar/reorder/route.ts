import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { rejectCrossOrigin } from "@/lib/security";
import { sidebarReorderSchema } from "@/lib/sidebarOrdering";

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sidebarReorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sidebar move" }, { status: 400 });

  const input = parsed.data;
  const targetParentId = input.kind === "note" ? input.targetFolderId : input.targetParentId;
  const { data, error } = await getSupabaseAdmin().rpc("reorder_nota_sidebar_item", {
    target_user_id: user.id,
    target_kind: input.kind,
    target_item_id: input.id,
    target_parent_id: targetParentId,
    target_before_id: input.beforeId ?? null,
    target_after_id: input.afterId ?? null,
  });

  if (error) {
    if (error.code === "P0002") return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (error.code === "P0003") return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
    if (error.code === "P0001" || error.code === "22023") {
      return NextResponse.json({ error: "Invalid folder or sibling destination" }, { status: 400 });
    }
    console.error("Sidebar reorder failed:", error);
    return NextResponse.json({ error: "Could not update sidebar order" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
