import { proxyIdentityRequest } from "@/modules/identity/server";
import { password_reset_confirmPOST } from "@/modules/identity/server";

export async function POST(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, password_reset_confirmPOST);
}
