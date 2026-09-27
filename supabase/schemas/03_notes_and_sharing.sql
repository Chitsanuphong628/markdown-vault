-- ==============================================================================
-- หมวดหมู่ 3: Notes & Sharing
-- ตารางบันทึกข้อความ (Markdown), ธีมสี, Revision (OCC), และระบบแชร์สาธารณะ
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public."Note" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    "folderId" TEXT REFERENCES public."Folder"(id) ON DELETE SET NULL,
    "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "legacyShareId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "themeColor" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index สำหรับ Foreign Key folderId (ป้องกัน Sequential Scan เวลาจัดการโฟลเดอร์)
CREATE INDEX IF NOT EXISTS "Note_folderId_idx" ON public."Note" ("folderId");
-- Index ดึงรายการโน้ตของผู้ใช้เรียงตามเวลาแก้ไขล่าสุด (User Note Listing)
CREATE INDEX IF NOT EXISTS "Note_userId_updatedAt_idx" ON public."Note" ("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "notes_user_idx" ON public."Note" ("userId");

-- Unique Index สำหรับ Public Shared Links
CREATE UNIQUE INDEX IF NOT EXISTS "Note_shareToken_key" 
    ON public."Note" ("shareToken") WHERE "shareToken" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Note_legacyShareId_key" 
    ON public."Note" ("legacyShareId") WHERE "legacyShareId" IS NOT NULL;
