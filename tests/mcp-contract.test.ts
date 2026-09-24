import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler, InMemoryTransport } from "@modelcontextprotocol/server";
import { createNotaMcpServer } from "../src/lib/mcp/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-key";

test("MCP exposes the ten established tools with bounded input schemas", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createNotaMcpServer("user-a", async () => false);
  const client = new Client({ name: "nota-contract-test", version: "1.0.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), [
      "create_folder", "create_note", "delete_folder", "delete_note", "get_note",
      "list_folders", "list_notes", "scan_and_cleanup", "share_note", "update_note",
    ]);
    assert.ok(tools.find(tool => tool.name === "update_note")?.inputSchema.required?.includes("revision"));
    const blocked = await client.callTool({ name: "list_folders", arguments: {} });
    assert.equal(blocked.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test("official Streamable HTTP client negotiates and lists tools", async () => {
  const handler = createMcpHandler(() => createNotaMcpServer("user-a"), { legacy: "stateless" });
  const transport = new StreamableHTTPClientTransport(new URL("https://nota.example/api/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init)),
  });
  const client = new Client({ name: "nota-http-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 10);
  } finally {
    await client.close();
  }
});
