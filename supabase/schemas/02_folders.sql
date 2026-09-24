-- ==============================================================================
-- หมวดหมู่ 2: Folders & Hierarchy
-- ตารางโครงสร้างโฟลเดอร์, การซ้อนโฟลเดอร์ (Nested Folders), และความสัมพันธ์
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public."Folder" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "parentId" TEXT REFERENCES public."Folder"(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Covering Index สำหรับ Parent Traversal และ Cascade Deletes
CREATE INDEX IF NOT EXISTS "Folder_parentId_idx" ON public."Folder" ("parentId");
-- Compound Index สำหรับกรองโฟลเดอร์ตามเจ้าของและ Parent
CREATE INDEX IF NOT EXISTS "Folder_userId_parentId_idx" ON public."Folder" ("userId", "parentId");
CREATE INDEX IF NOT EXISTS "folders_user_idx" ON public."Folder" ("userId");
