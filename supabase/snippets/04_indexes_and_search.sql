-- ==============================================================================
-- หมวดหมู่ 4: Search & Performance Indexes
-- เร่งความเร็วการค้นหาข้อความ และ Index เฉพาะทางสำหรับสเกลการใช้งานสูง
-- ==============================================================================

-- ติดตั้ง Extension pg_trgm สำหรับ Fuzzy / Trigram Pattern Matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram Index สำหรับเร่งความเร็วการค้นหา ILIKE '%keyword%' บน Note.title
CREATE INDEX IF NOT EXISTS "Note_title_trgm_idx" 
    ON public."Note" USING gin ("title" gin_trgm_ops);
