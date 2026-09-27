import { z } from "zod";

export const sidebarReorderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("note"),
    id: z.string().uuid(),
    targetFolderId: z.string().uuid().nullable(),
    beforeId: z.string().uuid().nullable().optional(),
    afterId: z.string().uuid().nullable().optional(),
  }).refine((value) => value.beforeId == null || value.afterId == null, "Choose beforeId or afterId"),
  z.object({
    kind: z.literal("folder"),
    id: z.string().uuid(),
    targetParentId: z.string().uuid().nullable(),
    beforeId: z.string().uuid().nullable().optional(),
    afterId: z.string().uuid().nullable().optional(),
  }).refine((value) => value.beforeId == null || value.afterId == null, "Choose beforeId or afterId"),
]);

export type SidebarReorderInput = z.infer<typeof sidebarReorderSchema>;

export function beforeIdAtDropPosition<T extends { id: string }>(
  siblings: readonly T[],
  targetId: string,
  placeAfter: boolean,
): string | null {
  const targetIndex = siblings.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return null;
  if (!placeAfter) return targetId;
  return siblings[targetIndex + 1]?.id ?? null;
}

export function beforeIdForMove<T extends { id: string }>(
  siblings: readonly T[],
  draggedId: string,
  targetId: string,
  placeAfter: boolean,
): string | null {
  return beforeIdAtDropPosition(siblings.filter((item) => item.id !== draggedId), targetId, placeAfter);
}

export function afterIdForMove<T extends { id: string }>(
  siblings: readonly T[],
  draggedId: string,
  targetId: string,
): string | null {
  if (draggedId === targetId || !siblings.some((item) => item.id === targetId)) return null;
  return targetId;
}
