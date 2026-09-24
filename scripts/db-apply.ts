import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || "nbdkkwomonxcrdwuvsaj";

if (!token) {
  console.error("❌ Error: SUPABASE_ACCESS_TOKEN is required in .env or environment variables.");
  process.exit(1);
}

const SNIPPETS_DIR = path.join(process.cwd(), "supabase", "snippets");

const ORDERED_SCRIPTS = [
  "01_users_and_auth.sql",
  "02_folders.sql",
  "03_notes_and_sharing.sql",
  "04_indexes_and_search.sql",
  "05_functions_and_rpcs.sql",
  "06_security_and_rls.sql",
];

async function executeSql(sql: string): Promise<void> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Database query failed (${res.status}): ${errorText}`);
  }
}

async function main() {
  const targetArg = process.argv[2];
  const scriptsToRun = targetArg
    ? [targetArg.endsWith(".sql") ? targetArg : `${targetArg}.sql`]
    : ORDERED_SCRIPTS;

  console.log(`\n🚀 Executing Supabase database scripts on project [${projectRef}]...\n`);

  for (const scriptName of scriptsToRun) {
    const filePath = path.join(SNIPPETS_DIR, scriptName);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Script file not found: ${filePath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, "utf8");
    process.stdout.write(`⏳ Running ${scriptName}... `);

    try {
      await executeSql(sql);
      console.log(`✅ Done`);
    } catch (err: any) {
      console.log(`❌ Failed`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log(`\n🎉 All requested scripts completed successfully!\n`);
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
