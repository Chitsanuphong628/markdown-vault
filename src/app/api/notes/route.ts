import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { rejectCrossOrigin } from "@/platform/server";
import { createNoteForOwner, listNotesForOwner, NotesOperationError } from "@/modules/notes/server";
import { z } from "zod";

const noteSchema = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().max(1_000_000).default(""),
  folderId: z.string().uuid().nullable().optional(),
});

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

  try {
    const result = await listNotesForOwner(user.id, { query: q, folderId, page });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = noteSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    const note = await createNoteForOwner(user.id, parsed.data);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof NotesOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create note" }, { status: 500 });
  }
}
