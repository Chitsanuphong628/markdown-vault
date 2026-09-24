-- Migration: Add covering indexes for foreign keys and search acceleration
-- Addresses Supabase Linter warnings 0001_unindexed_foreign_keys

-- 1. Index on Note.folderId for CASCADE / SET NULL and folder filtering
CREATE INDEX IF NOT EXISTS "Note_folderId_idx" ON public."Note" ("folderId");

-- 2. Index on Folder.parentId for folder tree traversal and deletion
CREATE INDEX IF NOT EXISTS "Folder_parentId_idx" ON public."Folder" ("parentId");

-- 3. Enable pg_trgm and add GIN index on Note.title for fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Note_title_trgm_idx" ON public."Note" USING gin ("title" gin_trgm_ops);
