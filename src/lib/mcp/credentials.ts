import { createHash, randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

const PREFIX = "nota_mcp_";
const LIFETIME_DAYS = 90;

export type McpPrincipal = { userId: string; credentialId: string; expiresAt: number };

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMcpCredential(userId: string) {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("McpCredential")
    .insert({ userId, tokenHash: digest(token), expiresAt })
    .select("id, createdAt, expiresAt")
    .single();
  if (error || !data) throw new Error("Could not create MCP credential");
  return { token, ...data };
}

export async function listMcpCredentials(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("McpCredential")
    .select("id, createdAt, expiresAt, revokedAt")
    .eq("userId", userId)
    .order("createdAt", { ascending: false });
  if (error) throw new Error("Could not list MCP credentials");
  return data ?? [];
}

export async function revokeMcpCredential(userId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("McpCredential")
    .update({ revokedAt: new Date().toISOString() })
    .eq("id", id)
    .eq("userId", userId)
    .is("revokedAt", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Could not revoke MCP credential");
  return Boolean(data);
}

export async function verifyMcpCredential(token: string): Promise<McpPrincipal | null> {
  if (!/^nota_mcp_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("McpCredential")
    .select("id, userId, expiresAt, revokedAt")
    .eq("tokenHash", digest(token))
    .maybeSingle();
  if (error || !data || data.revokedAt) return null;
  const expiresAt = Date.parse(data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const { data: user, error: userError } = await getSupabaseAdmin()
    .from("User")
    .select("id, emailVerified")
    .eq("id", data.userId)
    .maybeSingle();
  if (userError || !user || user.emailVerified !== true) return null;
  return { userId: user.id, credentialId: data.id, expiresAt: Math.floor(expiresAt / 1000) };
}
