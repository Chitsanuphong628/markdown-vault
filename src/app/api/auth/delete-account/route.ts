import { proxyIdentityRequest } from "@/modules/identity/server";
import { delete_accountDELETE } from "@/modules/identity/server";

export async function DELETE(request: Request): Promise<Response> {
  return proxyIdentityRequest(request, delete_accountDELETE);
}
