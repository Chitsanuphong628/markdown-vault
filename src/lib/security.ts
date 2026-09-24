import { NextResponse } from "next/server";
import { isTrustedAppUrl } from "./env";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function getEffectiveRequestOrigin(request: Request): string {
  let urlHost = "";
  let urlProto = "https";
  try {
    const parsed = new URL(request.url);
    urlHost = parsed.host;
    urlProto = parsed.protocol.replace(":", "");
  } catch { /* ignore */ }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");

  const host = forwardedHost || hostHeader || urlHost;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  const proto = forwardedProto || (isLocal ? "http" : (urlProto === "http" && !forwardedHost ? "http" : "https"));

  return host ? `${proto}://${host}` : "";
}

export function rejectCrossOrigin(request: Request): NextResponse | null {
  if (!MUTATION_METHODS.has(request.method)) return null;

  const referer = request.headers.get("referer");
  let refererOrigin: string | null = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch { /* ignore */ }
  }
  const originHeader = request.headers.get("origin") || refererOrigin;
  if (!originHeader) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  if (!isTrustedAppUrl(originUrl.origin)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const effectiveOrigin = getEffectiveRequestOrigin(request);
  if (!effectiveOrigin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    const effectiveUrl = new URL(effectiveOrigin);
    if (originUrl.host.toLowerCase() !== effectiveUrl.host.toLowerCase()) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
    if (!isLocal && originUrl.protocol !== "https:") {
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
