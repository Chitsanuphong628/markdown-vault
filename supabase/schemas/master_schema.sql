-- ==============================================================================
-- 🗄️ NOTA DATABASE - MASTER SCHEMA (จัดหมวดหมู่อย่างเป็นระเบียบ)
-- Project: note.md (nbdkkwomonxcrdwuvsaj)
-- 
-- สารบัญหมวดหมู่ (Table of Contents):
--   [01] USERS & AUTHENTICATION
--   [02] FOLDERS & HIERARCHY
--   [03] NOTES & SHARING
--   [04] SEARCH & PERFORMANCE INDEXES
--   [05] FUNCTIONS & STORED PROCEDURES (RPCs)
--   [06] SECURITY & ROW LEVEL SECURITY (RLS)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- [01] หมวดหมู่: USERS & AUTHENTICATION
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."User" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    name TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "verificationCodeHash" TEXT,
    "verificationExpiresAt" TIMESTAMPTZ,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetCodeHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMPTZ,
    "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User" (email);


-- ==============================================================================
-- [02] หมวดหมู่: FOLDERS & HIERARCHY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public."Folder" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    "parentId" TEXT REFERENCES public."Folder"(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes สำหรับโครงสร้างต้นไม้โฟลเดอร์และการค้นหา
CREATE INDEX IF NOT EXISTS "Folder_parentId_idx" ON public."Folder" ("parentId");
CREATE INDEX IF NOT EXISTS "Folder_userId_parentId_idx" ON public."Folder" ("userId", "parentId");
CREATE INDEX IF NOT EXISTS "folders_user_idx" ON public."Folder" ("userId");


-- ==============================================================================
-- [03] หมวดหมู่: NOTES & SHARING
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

-- Indexes สำหรับการดึงรายการโน้ตและการเชื่อมโยง
CREATE INDEX IF NOT EXISTS "Note_folderId_idx" ON public."Note" ("folderId");
CREATE INDEX IF NOT EXISTS "Note_userId_updatedAt_idx" ON public."Note" ("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "notes_user_idx" ON public."Note" ("userId");

-- Unique Indexes สำหรับ Public Share Links
CREATE UNIQUE INDEX IF NOT EXISTS "Note_shareToken_key" 
    ON public."Note" ("shareToken") WHERE "shareToken" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Note_legacyShareId_key" 
    ON public."Note" ("legacyShareId") WHERE "legacyShareId" IS NOT NULL;


-- ==============================================================================
-- [04] หมวดหมู่: SEARCH & PERFORMANCE INDEXES
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram Index สำหรับ Full-Text Search เร่งความเร็ว ILIKE '%keyword%'
CREATE INDEX IF NOT EXISTS "Note_title_trgm_idx" 
    ON public."Note" USING gin ("title" gin_trgm_ops);


-- ==============================================================================
-- [05] หมวดหมู่: FUNCTIONS & STORED PROCEDURES (RPCs)
-- ==============================================================================

-- 1. ฟังก์ชันย้าย/เปลี่ยนชื่อโฟลเดอร์ พร้อม Recursive Cycle Prevention
CREATE OR REPLACE FUNCTION public.update_nota_folder(
    target_folder_id TEXT,
    target_user_id TEXT,
    target_name TEXT,
    name_provided BOOLEAN,
    target_parent_id TEXT,
    parent_provided BOOLEAN
)
RETURNS "Folder"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    folder_row "Folder"%ROWTYPE;
    next_parent TEXT;
    has_cycle BOOLEAN;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(target_user_id));

    SELECT * INTO folder_row
    FROM "Folder"
    WHERE "id" = target_folder_id AND "userId" = target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'FOLDER_NOT_FOUND' USING errcode = 'P0002';
    END IF;

    next_parent := CASE
        WHEN parent_provided THEN target_parent_id
        ELSE folder_row."parentId"
    END;

    IF next_parent IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM "Folder"
            WHERE "id" = next_parent AND "userId" = target_user_id
        ) THEN
            RAISE EXCEPTION 'FOLDER_PARENT_NOT_FOUND' USING errcode = 'P0003';
        END IF;

        IF next_parent = target_folder_id THEN
            RAISE EXCEPTION 'FOLDER_CYCLE' USING errcode = 'P0001';
        END IF;

        WITH RECURSIVE ancestors(id) AS (
            SELECT next_parent
            UNION
            SELECT f."parentId"
            FROM "Folder" f
            JOIN ancestors a ON a.id = f."id"
            WHERE f."userId" = target_user_id AND f."parentId" IS NOT NULL
        )
        SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = target_folder_id)
        INTO has_cycle;

        IF has_cycle THEN
            RAISE EXCEPTION 'FOLDER_CYCLE' USING errcode = 'P0001';
        END IF;
    END IF;

    UPDATE "Folder"
    SET "name" = CASE WHEN name_provided THEN target_name ELSE folder_row."name" END,
        "parentId" = next_parent,
        "updatedAt" = now()
    WHERE "id" = target_folder_id AND "userId" = target_user_id
    RETURNING * INTO folder_row;

    RETURN folder_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_nota_folder(TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_nota_folder(TEXT, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN) TO service_role;


-- 2. ฟังก์ชันลบบัญชีผู้ใช้แบบ Atomic Cascade
CREATE OR REPLACE FUNCTION public.delete_nota_account(target_user_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public."Note" WHERE "userId"::TEXT = target_user_id;
    DELETE FROM public."Folder" WHERE "userId"::TEXT = target_user_id;
    DELETE FROM public."User" WHERE "id"::TEXT = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_nota_account(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_nota_account(TEXT) TO service_role;


-- 3. ฟังก์ชันลบโฟลเดอร์เฉพาะเมื่อว่าง (Zero Child Notes & Folders)
CREATE OR REPLACE FUNCTION public.delete_nota_empty_folder(target_folder_id TEXT, target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    found_id TEXT;
BEGIN
    SELECT f."id" INTO found_id 
    FROM "Folder" f
    WHERE f."id" = target_folder_id AND f."userId" = target_user_id 
    FOR UPDATE;

    IF found_id IS NULL THEN 
        RETURN false; 
    END IF;

    IF EXISTS (SELECT 1 FROM "Folder" c WHERE c."parentId" = found_id)
       OR EXISTS (SELECT 1 FROM "Note" n WHERE n."folderId" = found_id) THEN
        RETURN false;
    END IF;

    DELETE FROM "Folder" f WHERE f."id" = found_id AND f."userId" = target_user_id;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_nota_empty_folder(TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_nota_empty_folder(TEXT, TEXT) TO service_role;


-- ==============================================================================
-- [06] หมวดหมู่: SECURITY & ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Note" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."User", public."Folder", public."Note" FROM anon, authenticated;
GRANT ALL ON TABLE public."User", public."Folder", public."Note" TO service_role;

COMMIT;
