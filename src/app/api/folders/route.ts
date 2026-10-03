import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/identity/server";
import { rejectCrossOrigin } from "@/platform/server";
import { createFolderForOwner, listFoldersForOwner } from "@/modules/notes/server";
import { z } from "zod";

const folderSchema = z.object({ name: z.string().trim().min(1).max(120), parentId: z.string().uuid().nullable().optional() });

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const folders = await listFoldersForOwner(user.id);
    return NextResponse.json({ folders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list folders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const originError = rejectCrossOrigin(req);
  if (originError) return originError;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = folderSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    const folder = await createFolderForOwner(user.id, parsed.data.name, parsed.data.parentId);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.message === "Parent folder not found" ? 404 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create folder" }, { status });
  }
}
