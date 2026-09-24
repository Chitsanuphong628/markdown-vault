import { NextResponse } from "next/server";
import { isTrustedAppUrl } from "./env";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function rejectCrossOrigin(request: Request): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method)) return null;

  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin || !isTrustedAppUrl(request.url)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return null;
}

export function getClientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

/**
 * Escape values interpolated into a PostgREST `or(...)` filter. The API uses
 * the value only as a literal search term, so SQL/PostgREST wildcards must not
 * be allowed to change the filter expression.
 */
export function escapePostgrestSearch(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/[(),]/g, "\\$&")
    .replace(/[%_*]/g, "\\$&");
}
