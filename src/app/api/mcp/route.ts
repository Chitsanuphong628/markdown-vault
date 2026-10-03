import { serveMcpHttp } from "@/modules/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = serveMcpHttp;
export const GET = serveMcpHttp;
export const DELETE = serveMcpHttp;
