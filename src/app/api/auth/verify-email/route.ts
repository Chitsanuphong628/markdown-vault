import { proxyIdentityRequest } from "@/modules/identity/server";
import { verify_emailPOST } from "@/modules/identity/server";

export async function POST(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, verify_emailPOST);
}
