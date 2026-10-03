import { proxyIdentityRequest } from "@/modules/identity/server";
import { resend_verificationPOST } from "@/modules/identity/server";

export async function POST(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, resend_verificationPOST);
}
