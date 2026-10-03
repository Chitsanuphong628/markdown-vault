import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { rejectCrossOrigin } from "@/platform/server";
import { deleteNoteForOwner, getNoteForOwner, NotesOperationError, updateNoteForOwner } from "@/modules/notes/server";
import { z } from "zod";

const notePatchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  content: z.string().max(1_000_000).optional(),
  folderId: z.string().uuid().nullable().optional(),
  revision: z.number().int().nonnegative(),
}).refine((value) => value.title !== undefined || value.content !== undefined || value.folderId !== undefined, "No updates provided");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const note = await getNoteForOwner(user.id, id);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const parsed = notePatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note update" }, { status: 400 });
    const note = await updateNoteForOwner(user.id, id, parsed.data);
    if (!note) return NextResponse.json({ error: "Note was changed by another session" }, { status: 409 });
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof NotesOperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    await deleteNoteForOwner(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete note" }, { status: 500 });
  }
}
