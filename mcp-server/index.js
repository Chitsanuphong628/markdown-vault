#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server(
  {
    name: "markdown-vault-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Tools
const TOOLS = [
  {
    name: "list_notes",
    description: "สแกนและดึงรายชื่อโน้ตทั้งหมดในคลัง พร้อมรายละเอียดโฟลเดอร์",
    inputSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "กรองตาม Folder ID (เว้นว่างเพื่อดูทั้งหมด)" },
        searchQuery: { type: "string", description: "ค้นหาตามคำในชื่อหรือเนื้อหาโน้ต" },
        limit: { type: "number", description: "จำนวนโน้ตสูงสุดที่ต้องการ (ค่าเริ่มต้น 50)" },
      },
    },
  },
  {
    name: "get_note",
    description: "อ่านเนื้อหาเต็มของไฟล์ Markdown ตาม Note ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ของโน้ตที่ต้องการอ่าน" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_note",
    description: "สร้างโน้ต Markdown ใหม่ในระบบ สามารถใส่กราฟ Mermaid หรือเนื้อหาใดๆ ได้",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "ชื่อเรื่องของโน้ต" },
        content: { type: "string", description: "เนื้อหา Markdown ของโน้ต" },
        folderId: { type: "string", description: "ID ของโฟลเดอร์ที่จะจัดเก็บ (ถ้ามี)" },
        userId: { type: "string", description: "ID ของเจ้าของโน้ต (เว้นว่างเพื่อใช้ Default User)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_note",
    description: "แก้ไขหัวข้อ, เนื้อหา Markdown หรือย้ายโฟลเดอร์ของโน้ต",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ของโน้ตที่จะแก้ไข" },
        title: { type: "string", description: "ชื่อเรื่องใหม่" },
        content: { type: "string", description: "เนื้อหา Markdown ใหม่" },
        folderId: { type: "string", description: "ID โฟลเดอร์ใหม่ (หรือ null เพื่อเอาออกจากโฟลเดอร์)" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_note",
    description: "ลบโน้ตออกจากระบบตาม Note ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ของโน้ตที่จะลบ" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_folders",
    description: "ดึงโครงสร้างโฟลเดอร์ทั้งหมดในระบบเพื่อดู Tree Structure",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_folder",
    description: "สร้างโฟลเดอร์ใหม่สำหรับจัดหมวดหมู่โน้ต",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "ชื่อโฟลเดอร์" },
        parentId: { type: "string", description: "ID ของโฟลเดอร์แม่ (สำหรับโฟลเดอร์ซ้อนย่อย)" },
        userId: { type: "string", description: "ID ของผู้ใช้ (เว้นว่างเพื่อใช้ Default User)" },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_folder",
    description: "ลบโฟลเดอร์ออกจากระบบ (รวมถึงโน้ตที่อยู่ภายในโฟลเดอร์นี้)",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ของโฟลเดอร์ที่จะลบ" },
      },
      required: ["id"],
    },
  },
  {
    name: "share_note",
    description: "เปิดหรือปิดการแชร์โน้ตเป็นสาธารณะ พร้อมสร้างลิงก์สำหรับแชร์",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID ของโน้ตที่จะเปิด/ปิดแชร์" },
        isShared: { type: "boolean", description: "true เพื่อเปิดแชร์สาธารณะ, false เพื่อปิดแชร์" },
      },
      required: ["id", "isShared"],
    },
  },
  {
    name: "scan_and_cleanup",
    description: "สแกนภาพรวม ตรวจสอบสถิติผู้ใช้ โฟลเดอร์ โน้ตทั้งหมดในคลัง",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Helper to get default user
async function getDefaultUserId(customUserId) {
  if (customUserId) return customUserId;
  const { data } = await supabase.from("User").select("id").limit(1).single();
  return data ? data.id : null;
}

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_notes": {
        let query = supabase
          .from("Note")
          .select("id, title, folderId, isShared, createdAt, updatedAt, folder:Folder(name), user:User(email)")
          .order("updatedAt", { ascending: false });

        if (args.folderId) query = query.eq("folderId", args.folderId);
        if (args.searchQuery) {
          query = query.or(`title.ilike.%${args.searchQuery}%,content.ilike.%${args.searchQuery}%`);
        }
        if (args.limit) query = query.limit(args.limit);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_note": {
        const { data, error } = await supabase
          .from("Note")
          .select("*, folder:Folder(name), user:User(email)")
          .eq("id", args.id)
          .single();

        if (error) throw error;
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "create_note": {
        const userId = await getDefaultUserId(args.userId);
        if (!userId) throw new Error("No user found in database to assign note to.");

        const { data, error } = await supabase
          .from("Note")
          .insert([
            {
              title: args.title,
              content: args.content,
              folderId: args.folderId || null,
              userId,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return {
          content: [{ type: "text", text: `สร้างโน้ตสำเร็จ: ${data.id} (${data.title})` }],
        };
      }

      case "update_note": {
        const updateData = { updatedAt: new Date().toISOString() };
        if (args.title !== undefined) updateData.title = args.title;
        if (args.content !== undefined) updateData.content = args.content;
        if (args.folderId !== undefined) updateData.folderId = args.folderId;

        const { data, error } = await supabase
          .from("Note")
          .update(updateData)
          .eq("id", args.id)
          .select()
          .single();

        if (error) throw error;
        return {
          content: [{ type: "text", text: `อัปเดตโน้ตสำเร็จ: ${data.id} (${data.title})` }],
        };
      }

      case "delete_note": {
        const { error } = await supabase.from("Note").delete().eq("id", args.id);
        if (error) throw error;
        return {
          content: [{ type: "text", text: `ลบโน้ต ID: ${args.id} สำเร็จเรียบร้อย` }],
        };
      }

      case "list_folders": {
        const { data, error } = await supabase
          .from("Folder")
          .select("*, notes:Note(id, title)")
          .order("name", { ascending: true });

        if (error) throw error;
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "create_folder": {
        const userId = await getDefaultUserId(args.userId);
        if (!userId) throw new Error("No user found in database to assign folder to.");

        const { data, error } = await supabase
          .from("Folder")
          .insert([
            {
              name: args.name,
              parentId: args.parentId || null,
              userId,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return {
          content: [{ type: "text", text: `สร้างโฟลเดอร์สำเร็จ: ${data.id} (${data.name})` }],
        };
      }

      case "delete_folder": {
        const { error } = await supabase.from("Folder").delete().eq("id", args.id);
        if (error) throw error;
        return {
          content: [{ type: "text", text: `ลบโฟลเดอร์ ID: ${args.id} สำเร็จเรียบร้อย` }],
        };
      }

      case "share_note": {
        const { data, error } = await supabase
          .from("Note")
          .update({ isShared: Boolean(args.isShared), updatedAt: new Date().toISOString() })
          .eq("id", args.id)
          .select("id, title, isShared")
          .single();

        if (error) throw error;
        const msg = data.isShared
          ? `เปิดแชร์สาธารณะสำเร็จ: /share/${data.id}`
          : `ปิดการแชร์ของโน้ต ${data.id} แล้ว`;

        return {
          content: [{ type: "text", text: msg }],
        };
      }

      case "scan_and_cleanup": {
        const { data: users, count: userCount } = await supabase.from("User").select("id, email", { count: "exact" });
        const { data: folders, count: folderCount } = await supabase.from("Folder").select("id, name", { count: "exact" });
        const { data: notes, count: noteCount } = await supabase.from("Note").select("id, title, isShared", { count: "exact" });

        const summary = {
          totalUsers: userCount,
          users,
          totalFolders: folderCount,
          folders,
          totalNotes: noteCount,
          notes,
          timestamp: new Date().toISOString(),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err.message}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Markdown Vault MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
