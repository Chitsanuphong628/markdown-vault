export type McpToolCategory = "Read" | "Write" | "Share" | "Maintenance";
export interface McpToolItem {
  name: string;
  category: McpToolCategory;
  desc: { en: string; th: string };
}

export const MCP_TOOLS: McpToolItem[] = [
  { name: "list_notes", category: "Read", desc: { en: "List and search notes across folders", th: "แสดงและค้นหาโน้ตในโฟลเดอร์" } },
  { name: "get_note", category: "Read", desc: { en: "Read a note and its frontmatter by ID", th: "อ่านโน้ตและ frontmatter จาก ID" } },
  { name: "create_note", category: "Write", desc: { en: "Create a Markdown note in a folder", th: "สร้างโน้ต Markdown ในโฟลเดอร์" } },
  { name: "update_note", category: "Write", desc: { en: "Edit a note title, content, or folder", th: "แก้ชื่อ เนื้อหา หรือโฟลเดอร์ของโน้ต" } },
  { name: "delete_note", category: "Write", desc: { en: "Delete a note", th: "ลบโน้ต" } },
  { name: "list_folders", category: "Read", desc: { en: "List folders and subfolders", th: "แสดงโฟลเดอร์และโฟลเดอร์ย่อย" } },
  { name: "create_folder", category: "Write", desc: { en: "Create a folder", th: "สร้างโฟลเดอร์" } },
  { name: "delete_folder", category: "Write", desc: { en: "Delete an empty folder", th: "ลบโฟลเดอร์ที่ไม่มีโน้ต" } },
  { name: "share_note", category: "Share", desc: { en: "Enable or disable a public link", th: "เปิดหรือปิดลิงก์สาธารณะ" } },
  { name: "scan_and_cleanup", category: "Maintenance", desc: { en: "Count notes and folders without changing them", th: "นับโน้ตและโฟลเดอร์โดยไม่แก้ข้อมูล" } },
];
