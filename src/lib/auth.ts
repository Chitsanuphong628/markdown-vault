import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

const JWT_SECRET = process.env.JWT_SECRET || "markdown-vault-super-secret-key-2026";
const COOKIE_NAME = "token";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function signApiKey(payload: TokenPayload): string {
  return "nota_sec_" + jwt.sign({ ...payload, type: "mcp_api_key" }, JWT_SECRET, { expiresIn: "365d" });
}

export function verifyApiKey(token: string): TokenPayload | null {
  try {
    const rawToken = token.startsWith("nota_sec_") ? token.replace("nota_sec_", "") : token;
    const decoded = jwt.verify(rawToken, JWT_SECRET) as TokenPayload & { type?: string };
    if (decoded && decoded.userId) {
      return { userId: decoded.userId, email: decoded.email };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { data: user, error } = await supabaseAdmin
    .from("User")
    .select("id, email, name")
    .eq("id", payload.userId)
    .single();

  if (error || !user) return null;

  return user;
}
