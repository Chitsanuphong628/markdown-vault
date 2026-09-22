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
    return jwt.verify(token, getWebJwtSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    }) as TokenPayload;
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

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { data: user, error } = await getSupabaseAdmin()
    .from("User")
    .select("id, email, name, emailVerified")
    .eq("id", payload.userId)
    .single();

  if (error || !user) return null;

  return user;
}
