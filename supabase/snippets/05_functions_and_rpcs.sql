-- ==============================================================================
-- หมวดหมู่ 5: Functions & Stored Procedures (RPCs)
-- ตรรกะระดับฐานข้อมูล: ย้ายโฟลเดอร์แบบป้องกัน Loop และลบบัญชีแบบ Atomic
-- ==============================================================================

-- 1. ฟังก์ชันย้าย/เปลี่ยนชื่อโฟลเดอร์ พร้อม Recursive Ancestry Cycle Prevention
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
    -- Advisory XACT Lock เพื่อป้องกัน Race Condition ระหว่างการย้ายโฟลเดอร์ชนกัน
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
