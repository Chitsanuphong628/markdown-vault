export type LocalIdentityHandler = (request: Request) => Response | Promise<Response>;
type Fetcher = typeof fetch;

const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "x-forwarded-for",
  "x-vercel-forwarded-for",
  "x-real-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
] as const;
const forwardedResponseHeaders = ["cache-control", "content-type", "retry-after", "www-authenticate"] as const;

export interface IdentityServiceClientOptions {
  baseUrl: string | null;
  caller: string;
  token: string | null;
  fetcher?: Fetcher;
}

function normalizeBaseUrl(value: string | null): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("NOTA_IDENTITY_SERVICE_URL must be a valid URL"); }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Identity service must use HTTPS outside loopback development");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function safeResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  const bodyless = upstream.status === 204 || upstream.status === 304 || upstream.status === 205;
  return new Response(bodyless ? null : upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

function serviceHeaders(service: string, token: string): Headers {
  return new Headers({
    "content-type": "application/json",
    "x-nota-service": service,
    authorization: `Bearer ${token}`,
  });
}

function isSessionUser(value: unknown): value is { id: string; email: string; name: string | null; emailVerified: boolean } {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === "string" && typeof user.email === "string" && (typeof user.name === "string" || user.name === null) && typeof user.emailVerified === "boolean";
}

export function createIdentityServiceClient(options: IdentityServiceClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher = options.fetcher ?? fetch;

  return {
    configured: Boolean(baseUrl),

    async proxyOrLocal(request: Request, localHandler: LocalIdentityHandler): Promise<Response> {
      if (!baseUrl) return localHandler(request);
      const incomingUrl = new URL(request.url);
      const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, `${baseUrl}/`);
      if (!options.token) return Response.json({ error: "ระบบบัญชียังไม่พร้อมใช้งาน" }, { status: 503, headers: { "cache-control": "no-store" } });
      const headers = new Headers();
      for (const name of forwardedRequestHeaders) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      const originalHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || incomingUrl.host;
      const originalProtocol = request.headers.get("x-forwarded-proto") || incomingUrl.protocol.slice(0, -1);
      headers.set("x-forwarded-host", originalHost);
      headers.set("x-forwarded-proto", originalProtocol);
      headers.set("x-nota-service", options.caller);
      headers.set("authorization", `Bearer ${options.token}`);
      const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
      try {
        const upstream = await fetcher(upstreamUrl, {
          method: request.method,
          headers,
          body: hasBody ? await request.arrayBuffer() : undefined,
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(8000),
        });
        return safeResponse(upstream);
      } catch {
        return Response.json({ error: "ระบบบัญชียังไม่พร้อมใช้งาน" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    },

    async verifySession(tokenValue: string): Promise<{ id: string; email: string; name: string | null; emailVerified: boolean } | null> {
      if (!baseUrl || !options.token) return null;
      try {
        const response = await fetcher(`${baseUrl}/api/internal/session/verify`, {
          method: "POST",
          headers: serviceHeaders(options.caller, options.token),
          body: JSON.stringify({ token: tokenValue }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const body: unknown = await response.json();
        return body && typeof body === "object" && isSessionUser((body as { user?: unknown }).user)
          ? (body as { user: { id: string; email: string; name: string | null; emailVerified: boolean } }).user
          : null;
      } catch {
        return null;
      }
    },

    async isEmailVerified(userId: string): Promise<boolean> {
      if (!baseUrl || !options.token) return false;
      const response = await fetcher(`${baseUrl}/api/internal/email-verified`, {
        method: "POST",
        headers: serviceHeaders(options.caller, options.token),
        body: JSON.stringify({ userId }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (response.status >= 500) throw new Error("Identity service is unavailable");
      if (!response.ok) return false;
      const body: unknown = await response.json();
      return Boolean(body && typeof body === "object" && (body as { verified?: unknown }).verified === true);
    },
  };
}

export function getWebIdentityServiceClient() {
  return createIdentityServiceClient({
    baseUrl: process.env.NOTA_IDENTITY_SERVICE_URL?.trim() || null,
    caller: "nota-web",
    token: process.env.NOTA_IDENTITY_WEB_TOKEN?.trim() || null,
  });
}

export function getMcpIdentityServiceClient() {
  return createIdentityServiceClient({
    baseUrl: process.env.NOTA_IDENTITY_SERVICE_URL?.trim() || null,
    caller: "nota-mcp-service",
    token: process.env.NOTA_IDENTITY_MCP_TOKEN?.trim() || null,
  });
}

export function proxyIdentityRequest(request: Request, localHandler: LocalIdentityHandler): Promise<Response> {
  return getWebIdentityServiceClient().proxyOrLocal(request, localHandler);
}
