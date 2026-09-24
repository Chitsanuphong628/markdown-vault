-- ==============================================================================
-- หมวดหมู่ 6: Security & Row Level Security (RLS)
-- บังคับความปลอดภัย ปิดการเข้าถึงตรงจากหน้าบ้าน (Anon/Auth) และมอบสิทธิ์เฉพาะ Backend Service Role
-- ==============================================================================

-- 1. เปิด RLS บนทุกตารางหลัก
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Note" ENABLE ROW LEVEL SECURITY;

-- 2. Revoke การเข้าถึงโดยตรงจาก Client ที่ถือ Publishable API Key
REVOKE ALL ON TABLE public."User", public."Folder", public."Note" FROM anon, authenticated;

-- 3. ให้สิทธิ์เฉพาะ Backend Service Role เท่านั้น
GRANT ALL ON TABLE public."User", public."Folder", public."Note" TO service_role;
