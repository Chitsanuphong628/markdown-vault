import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { assertOwnedFolder } from "@/lib/ownership";
import { escapePostgrestSearch, rejectCrossOrigin } from "@/lib/security";
import { z } from "zod";
import { isNoteColorKey, parseNoteTheme } from "@/lib/noteTheme";

const noteSchema = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().max(1_000_000).default(""),
  folderId: z.string().uuid().nullable().optional(),
});
const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const folderId = searchParams.get("folderId");
  const rawPage = searchParams.get("page") || "0";
  const page = Number.parseInt(rawPage, 10);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10_000
    || q.length > 200 || (folderId && !z.string().uuid().safeParse(folderId).success)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  let query = getSupabaseAdmin()
    .from("Note")
    .select("id, title, themeColor, folderId, createdAt, updatedAt, revision")
    .eq("userId", user.id)
    .order("updatedAt", { ascending: false });

  if (folderId) {
    query = query.eq("folderId", folderId);
  }

  if (q) {
    const searchTerm = escapePostgrestSearch(q);
    query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
  }

  const { data: notes, error } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mappedNotes = (notes || []).map((n: {
    id: string;
    title: string;
    themeColor?: string | null;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
    revision: number;
  }) => {
    const color = isNoteColorKey(n.themeColor) ? n.themeColor : "default";
    return {
      id: n.id,
      title: n.title,
      folderId: n.folderId,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      revision: n.revision,
      color,
    };
  });

  return NextResponse.json({ notes: mappedNotes, page, pageSize: PAGE_SIZE, hasMore: (notes?.length || 0) === PAGE_SIZE });
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = noteSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    const { title, content, folderId } = parsed.data;
    if (!(await assertOwnedFolder(folderId, user.id))) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    const { data: note, error } = await getSupabaseAdmin()
      .from("Note")
      .insert([
        {
          title,
          content,
          themeColor: parseNoteTheme(content).color,
          folderId: folderId || null,
          userId: user.id,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
  }
}
