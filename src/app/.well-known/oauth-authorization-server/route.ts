import { serveMcpOAuthMetadata } from "@/modules/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = serveMcpOAuthMetadata;
export const OPTIONS = serveMcpOAuthMetadata;
