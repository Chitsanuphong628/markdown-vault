/**
 * Runtime configuration deliberately stays lazy so `next build` can run without
 * production secrets. Every request that needs a privileged integration fails
 * closed when the corresponding Vercel secret is absent.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseConfig() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getWebJwtSecret(): string {
  return required("JWT_SECRET");
}

export function getTokenPepper(): string {
  const value = process.env.AUTH_TOKEN_PEPPER?.trim() || process.env.JWT_SECRET?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: AUTH_TOKEN_PEPPER or JWT_SECRET");
  }
  return value;
}

export function getPublicAppUrl(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (requestUrl && process.env.VERCEL_ENV === "preview") {
    return new URL(requestUrl).origin;
  }
  if (configured) return new URL(configured).origin;
  if (requestUrl && process.env.NODE_ENV !== "production") {
    return new URL(requestUrl).origin;
  }
  throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
}

/** Trusted serving origins, separate from the canonical URL used for metadata. */
export function isTrustedAppUrl(requestUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }
  const origin = parsed.origin;
  const httpsOrigin = `https://${parsed.host}`;
  const allowed = new Set<string>();

  for (const value of (process.env.APP_ALLOWED_ORIGINS ?? "").split(",")) {
    try {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const configured = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (configured.protocol === "https:") allowed.add(configured.origin);
    } catch { /* fail closed for invalid entries */ }
  }

  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    const domains = process.env.VERCEL_ENV === "production"
      ? [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
      : [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL];
    for (const domain of domains) {
      if (!domain) continue;
      const clean = domain.trim().replace(/^https?:\/\//i, "").toLowerCase();
      if (/^[a-z0-9.-]+$/i.test(clean)) {
        allowed.add(`https://${clean}`);
      }
    }
  }

  const canonical = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical.startsWith("http") ? canonical : `https://${canonical}`);
      if (canonicalUrl.protocol === "https:" || process.env.NODE_ENV !== "production") {
        if (!process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_ENV !== "production") {
          allowed.add(canonicalUrl.origin);
        }
      }
    } catch { /* fail closed for invalid entries */ }
  }

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL_ENV
    && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    allowed.add(origin);
    allowed.add(httpsOrigin);
  }

  return allowed.has(origin) || allowed.has(httpsOrigin);
}
