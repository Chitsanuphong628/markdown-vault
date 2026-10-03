import { proxyIdentityRequest } from "@/modules/identity/server";
import { loginPOST } from "@/modules/identity/server";

export async function POST(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, loginPOST);
}
