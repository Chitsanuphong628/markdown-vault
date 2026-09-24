import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { getTokenPepper, getWebJwtSecret } from "./env";

const COOKIE_NAME = "token";
const SESSION_ISSUER = "nota-web";
const SESSION_AUDIENCE = "nota-web";

export interface TokenPayload {
  userId: string;
  email: string;
  sessionVersion: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getWebJwtSecret(), {
    expiresIn: "7d",
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, getWebJwtSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    }) as Partial<TokenPayload>;
    const sessionVersion = decoded.sessionVersion;

    if (
      typeof decoded.userId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof sessionVersion !== "number" ||
      !Number.isInteger(sessionVersion) ||
      sessionVersion < 0
    ) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      sessionVersion,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createOneTimeCode(): string {
  return crypto.randomInt(100000, 1_000_000).toString();
}

export function hashOneTimeCode(code: string): string {
  return crypto.createHmac("sha256", getTokenPepper()).update(code).digest("hex");
}

export function matchesOneTimeCode(code: string, expectedHash: string | null | undefined): boolean {
  if (!expectedHash || !/^\d{6}$/.test(code)) return false;
  const actual = Buffer.from(hashOneTimeCode(code), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface CachedSession {
  user: SessionUser;
  sessionVersion: number;
  expiresAt: number;
}

export const sessionCache = new Map<string, CachedSession>();
export const SESSION_CACHE_TTL_MS = 15_000; // 15 seconds

export function invalidateSessionUser(userId: string): void {
  sessionCache.delete(userId);
}

export function clearSessionCache(): void {
  sessionCache.clear();
}

export async function resolveUserFromPayload(
  payload: TokenPayload,
  fetchUserFromDb: (userId: string) => Promise<{ id: string; email: string; name: string; emailVerified: boolean; sessionVersion: number } | null>
): Promise<SessionUser | null> {
  const now = Date.now();
  const cached = sessionCache.get(payload.userId);
  if (cached && cached.expiresAt > now) {
    if (cached.sessionVersion === payload.sessionVersion) {
      return cached.user;
    }
    sessionCache.delete(payload.userId);
    return null;
  }

  const user = await fetchUserFromDb(payload.userId);
  if (!user || user.sessionVersion !== payload.sessionVersion) {
    sessionCache.delete(payload.userId);
    return null;
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  };

  if (sessionCache.size >= 2000) {
    for (const [key, val] of sessionCache.entries()) {
      if (val.expiresAt <= now) sessionCache.delete(key);
    }
    if (sessionCache.size >= 2000) {
      sessionCache.clear();
    }
  }

  sessionCache.set(payload.userId, {
    user: sessionUser,
    sessionVersion: user.sessionVersion,
    expiresAt: now + SESSION_CACHE_TTL_MS,
  });

  return sessionUser;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return resolveUserFromPayload(payload, async (userId) => {
    const { data: user, error } = await getSupabaseAdmin()
      .from("User")
      .select("id, email, name, emailVerified, sessionVersion")
      .eq("id", userId)
      .single();

    if (error || !user) return null;
    return user;
  });
}
