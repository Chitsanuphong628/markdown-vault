-- ==============================================================================
-- หมวดหมู่ 1: Users & Authentication
-- ตารางบัญชีผู้ใช้, ระบบความปลอดภัย, OTP, Session Version และ Verification
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

-- Unique index บน email สำหรับการค้นหาและยืนยันตัวตน
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User" (email);
