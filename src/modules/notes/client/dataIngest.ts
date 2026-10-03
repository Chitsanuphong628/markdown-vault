import * as Papa from "papaparse";

export interface DataIngestResult {
  title: string;
  markdown: string;
}

const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".csv", ".tsv", ".json"];

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension))
    || ["text/markdown", "text/csv", "application/json"].includes(file.type);
}

export async function importFiles(files: File[], folderId: string | null, fetchNote: typeof fetch = fetch) {
  const imported: File[] = [];
  const failed: Array<{ file: File; error: string }> = [];
  for (const file of files) {
    try {
      if (!isSupportedFile(file)) throw new Error("Unsupported file type");
      const { title, markdown } = await convertFileToMarkdown(file);
      const response = await fetchNote("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: markdown, folderId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `Could not save note (${response.status})`);
      }
      if (typeof body.note?.id !== "string") throw new Error("Note was not confirmed by the server");
      imported.push(file);
    } catch (error) {
      failed.push({ file, error: error instanceof Error ? error.message : "Import failed" });
    }
  }
  return { imported, failed };
}

/**
 * Parses raw file and converts to clean, structured markdown note with data profiling.
 */
export async function convertFileToMarkdown(file: File): Promise<DataIngestResult> {
  const fileName = file.name;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const rawTitle = fileName.replace(/\.[^/.]+$/, "");

  if (ext === "md" || ext === "markdown" || (ext !== "csv" && ext !== "tsv" && ext !== "json" && file.type === "text/markdown")) {
    const text = await file.text();
    return { title: rawTitle, markdown: text };
  }

  if (ext === "csv" || ext === "tsv" || file.type === "text/csv") {
    return await convertDelimitedToMarkdown(file, rawTitle, ext === "tsv" ? "\t" : ",");
  }

  if (ext === "json" || file.type === "application/json") {
    return await convertJsonToMarkdown(file, rawTitle);
  }

  // Fallback for plain text or unexpected types
  const fallbackText = await file.text();
  return {
    title: rawTitle,
    markdown: `\`\`\`text\n${fallbackText}\n\`\`\``,
  };
}

/**
 * Converts CSV / TSV to an analytical Markdown note with Data Dictionary and Preview.
 */
async function convertDelimitedToMarkdown(
  file: File,
  title: string,
  delimiter: string
): Promise<DataIngestResult> {
  const text = await file.text();

  const results = Papa.parse<Record<string, unknown>>(text, {
    delimiter: delimiter,
    header: true,
    skipEmptyLines: true,
  });

  const rows = results.data || [];
  const fields = results.meta.fields || [];

  if (rows.length === 0 || fields.length === 0) {
    return {
      title,
      markdown: `# ${title}\n\n> ⚠️ Empty dataset or unable to parse header fields.`,
    };
  }

  // 1. Column profiling
  const columnProfiles = fields.map((col) => {
    let nullCount = 0;
    let numericCount = 0;
    let booleanCount = 0;
    const sampleValues = new Set<string>();

    rows.forEach((row) => {
      const val = row[col];
      if (val === undefined || val === null || String(val).trim() === "") {
        nullCount++;
      } else {
        const strVal = String(val).trim();
        if (sampleValues.size < 4) sampleValues.add(strVal);

        if (!isNaN(Number(strVal)) && strVal !== "") {
          numericCount++;
        } else if (strVal.toLowerCase() === "true" || strVal.toLowerCase() === "false") {
          booleanCount++;
        }
      }
    });

    const nonNull = rows.length - nullCount;
    let inferredType = "string";
    if (nonNull > 0 && numericCount === nonNull) {
      inferredType = "number";
    } else if (nonNull > 0 && booleanCount === nonNull) {
      inferredType = "boolean";
    }

    return {
      name: col,
      type: inferredType,
      nullCount,
      nullPct: Math.round((nullCount / rows.length) * 100),
      samples: Array.from(sampleValues).slice(0, 3).join(", "),
    };
  });

  // 2. Data Dictionary table
  let dictMd = "| Column | Inferred Type | Missing | Sample Values |\n";
  dictMd += "|:---|:---:|:---:|:---|\n";
  columnProfiles.forEach((p) => {
    const missingStr = p.nullCount > 0 ? `${p.nullCount} (${p.nullPct}%)` : "0";
    dictMd += `| \`${p.name}\` | \`${p.type}\` | ${missingStr} | ${p.samples.replace(/\|/g, "\\|") || "-"} |\n`;
  });

  // 3. Preview first 25 rows
  const PREVIEW_LIMIT = 25;
  const previewRows = rows.slice(0, PREVIEW_LIMIT);

  let previewMd = `| ${fields.map((f) => f.replace(/\|/g, "\\|")).join(" | ")} |\n`;
  previewMd += `| ${fields.map(() => ":---").join(" | ")} |\n`;

  previewRows.forEach((r) => {
    const cells = fields.map((f) => {
      const val = r[f] !== undefined && r[f] !== null ? String(r[f]).replace(/\|/g, "\\|").replace(/\n/g, " ") : "";
      return val.length > 50 ? `${val.slice(0, 47)}...` : val;
    });
    previewMd += `| ${cells.join(" | ")} |\n`;
  });

  const mdContent = `# 📊 ${title}

> **Data Profile Summary**
> - **Total Rows:** \`${rows.length.toLocaleString()}\`
> - **Columns:** \`${fields.length}\`
> - **Source Format:** \`${delimiter === "\t" ? "TSV" : "CSV"}\`
> - **Generated By:** Nota Universal Data Ingester

---

## 1. Data Dictionary & Schema

${dictMd}

---

## 2. Data Preview (First ${Math.min(PREVIEW_LIMIT, rows.length)} Rows)

${previewMd}
${rows.length > PREVIEW_LIMIT ? `\n*Showing first ${PREVIEW_LIMIT} of ${rows.length.toLocaleString()} rows.*\n` : ""}

---

## 3. Machine Learning & AI Context

\`\`\`python
import pandas as pd

# Load dataset
df = pd.read_csv("${file.name}")
print(df.info())
print(df.describe())
\`\`\`
`;

  return {
    title,
    markdown: mdContent,
  };
}

/**
 * Converts JSON to structured Markdown note with schema analysis.
 */
async function convertJsonToMarkdown(file: File, title: string): Promise<DataIngestResult> {
  const text = await file.text();

  try {
    const data = JSON.parse(text);

    if (Array.isArray(data)) {
      const isObjectArray = data.length > 0 && typeof data[0] === "object" && data[0] !== null;

      if (isObjectArray) {
        const fields = Array.from(
          new Set(data.flatMap((item) => (typeof item === "object" && item ? Object.keys(item) : [])))
        );

        const PREVIEW_LIMIT = 25;
        const previewRows = data.slice(0, PREVIEW_LIMIT);

        let previewMd = `| ${fields.map((f) => f.replace(/\|/g, "\\|")).join(" | ")} |\n`;
        previewMd += `| ${fields.map(() => ":---").join(" | ")} |\n`;

        previewRows.forEach((r) => {
          const cells = fields.map((f) => {
            const val = r[f] !== undefined && r[f] !== null ? JSON.stringify(r[f]).replace(/\|/g, "\\|") : "";
            return val.length > 50 ? `${val.slice(0, 47)}...` : val;
          });
          previewMd += `| ${cells.join(" | ")} |\n`;
        });

        const mdContent = `# 📦 ${title} (JSON Array)

> **Dataset Summary**
> - **Total Records:** \`${data.length.toLocaleString()}\`
> - **Attributes:** \`${fields.length}\` (${fields.map((f) => `\`${f}\``).join(", ")})

---

## 1. Structured Data Preview

${previewMd}
${data.length > PREVIEW_LIMIT ? `\n*Showing first ${PREVIEW_LIMIT} of ${data.length.toLocaleString()} records.*\n` : ""}

---

## 2. Raw JSON Sample

\`\`\`json
${JSON.stringify(data.slice(0, 2), null, 2)}
\`\`\`
`;
        return { title, markdown: mdContent };
      }
    }

    // Key-value object or generic JSON
    const keys = Object.keys(data);
    let summaryMd = "| Key | Type | Value Preview |\n|:---|:---:|:---|\n";
    keys.forEach((k) => {
      const val = data[k];
      const valType = Array.isArray(val) ? "array" : typeof val;
      const previewStr = JSON.stringify(val).slice(0, 60).replace(/\|/g, "\\|");
      summaryMd += `| \`${k}\` | \`${valType}\` | \`${previewStr}\` |\n`;
    });

    const mdContent = `# 📦 ${title} (JSON Object)

> **Root Keys:** \`${keys.length}\`

---

## 1. Schema Overview

${summaryMd}

---

## 2. Complete JSON Document

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;

    return { title, markdown: mdContent };
  } catch {
    throw new Error("Invalid JSON file");
  }
}
