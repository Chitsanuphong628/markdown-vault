import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { verifyMcpCredential } from "./credentials";
import { createNotaMcpServer } from "./server";

async function main() {
  if (process.env.ENABLE_MCP !== "true") throw new Error("MCP is disabled");
  const token = process.env.NOTA_API_KEY;
  if (!token) throw new Error("NOTA_API_KEY is required for stdio MCP");
  const principal = await verifyMcpCredential(token);
  if (!principal) throw new Error("Invalid, expired, or revoked MCP credential");
  serveStdio(() => createNotaMcpServer(principal.userId, async () => {
    const current = await verifyMcpCredential(token);
    return current?.userId === principal.userId && current.credentialId === principal.credentialId;
  }), {
    onerror: (error) => console.error("MCP stdio error:", error),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "MCP startup failed");
  process.exitCode = 1;
});
