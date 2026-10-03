import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler, InMemoryTransport } from "@modelcontextprotocol/server";
import { createNotaMcpServer, type NotaMcpOperations } from "../src/modules/mcp/server/notaServer";
import { MCP_TOOLS } from "../src/modules/mcp/shared";

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
    assert.deepEqual(MCP_TOOLS.map(tool => tool.name).sort(), tools.map(tool => tool.name).sort());
    const blocked = await client.callTool({ name: "list_folders", arguments: {} });
    assert.equal(blocked.isError, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test("all ten MCP tools call the corresponding Notes operation for the authenticated owner", async () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const folderId = "22222222-2222-4222-8222-222222222222";
  const calls: Array<{ operation: string; userId: string }> = [];
  const record = (operation: string, userId: string) => { calls.push({ operation, userId }); };
  const notes: NotaMcpOperations = {
    async listNotesForMcp(userId) { record("list_notes", userId); return [{ id: noteId }]; },
    async getNoteForMcp(userId) { record("get_note", userId); return { id: noteId, title: "Note", content: "Body" }; },
    async createNoteForOwner(userId) { record("create_note", userId); return { id: noteId, title: "Note", revision: 0 }; },
    async updateNoteForOwner(userId) { record("update_note", userId); return { id: noteId, title: "Note", revision: 1 }; },
    async deleteNoteForOwner(userId) { record("delete_note", userId); return { id: noteId }; },
    async listFoldersForMcp(userId) { record("list_folders", userId); return [{ id: folderId, name: "Folder" }]; },
    async createFolderForOwner(userId) { record("create_folder", userId); return { id: folderId, name: "Folder", parentId: null }; },
    async deleteEmptyFolderForOwner(userId) { record("delete_folder", userId); return true; },
    async setNoteSharingForOwner(userId, id, isShared) {
      record("share_note", userId);
      return { id, title: "Note", isShared, shareToken: isShared ? "a".repeat(64) : null };
    },
    async countVaultForOwner(userId) { record("scan_and_cleanup", userId); return { totalNotes: 1, totalFolders: 1 }; },
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createNotaMcpServer("owner-a", async () => true, notes);
  const client = new Client({ name: "nota-operations-test", version: "1.0.0" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    for (const input of [
      { name: "list_notes", arguments: { folderId, searchQuery: "heart", limit: 10 } },
      { name: "get_note", arguments: { id: noteId } },
      { name: "create_note", arguments: { title: "Note", content: "Body", folderId } },
      { name: "update_note", arguments: { id: noteId, revision: 0, content: "Updated" } },
      { name: "delete_note", arguments: { id: noteId } },
      { name: "list_folders", arguments: {} },
      { name: "create_folder", arguments: { name: "Folder", parentId: folderId } },
      { name: "delete_folder", arguments: { id: folderId } },
      { name: "share_note", arguments: { id: noteId, isShared: true } },
      { name: "scan_and_cleanup", arguments: {} },
    ]) {
      const result = await client.callTool(input);
      assert.equal(result.isError, undefined, `${input.name} should succeed`);
    }
  } finally {
    await client.close();
    await server.close();
  }
  assert.deepEqual(calls.map(call => call.operation), [
    "list_notes", "get_note", "create_note", "update_note", "delete_note",
    "list_folders", "create_folder", "delete_folder", "share_note", "scan_and_cleanup",
  ]);
  assert.ok(calls.every(call => call.userId === "owner-a"));
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
