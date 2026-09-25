import { enforceAuthRateLimit } from "@/lib/rate-limit";
import { getClientAddress } from "@/lib/security";

export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

export function allowOAuthRequest(request: Request, action: "token" | "register") {
  return enforceAuthRateLimit(`oauth-${action}:${getClientAddress(request)}`);
}
