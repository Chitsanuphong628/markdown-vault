import { proxyIdentityRequest } from "@/modules/identity/server";
import { meGET } from "@/modules/identity/server";

export async function GET(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, meGET);
}
