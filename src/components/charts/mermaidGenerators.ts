/**
 * Pure generator functions for generating clean, syntax-valid Mermaid diagrams
 * with proper escaping, dynamic axis scaling, and theme directives.
 */

export interface FlowNode {
  id: string;
  label: string;
  shape: "rect" | "round" | "diamond" | "database";
  /** Optional custom outgoing connections (e.g. Yes/No branches from a decision) */
  branches?: Array<{ targetId: string; label?: string }>;
}

export interface FlowchartOptions {
  title?: string;
  direction: "TD" | "LR";
  nodes: FlowNode[];
}

export interface SequenceMessage {
  from: string;
  to: string;
  text: string;
  type: "solid" | "dotted" | "fail";
}

export interface SequenceOptions {
  title?: string;
  participants: Array<{ id: string; label: string }>;
  messages: SequenceMessage[];
}

export interface ChartDataItem {
  label: string;
  value: number;
  lineValue?: number;
}

export interface BarLineChartOptions {
  title: string;
  mode: "bar" | "line" | "both";
  items: ChartDataItem[];
  yAxisTitle?: string;
}

export interface PieOptions {
  title: string;
  items: Array<{ label: string; value: number }>;
}

export interface MindmapBranch {
  label: string;
  subBranches?: string[];
}

export interface MindmapOptions {
  root: string;
  branches: MindmapBranch[];
}

export interface StateTransition {
  from: string;
  to: string;
  label?: string;
}

export interface StateDiagramOptions {
  title?: string;
  transitions: StateTransition[];
}

/** Sanitize node text and labels to prevent Mermaid syntax breaks */
export function sanitizeLabel(text: string): string {
  if (!text) return "";
  return text
    .replace(/"/g, "'")
    .replace(/[[\]{}()<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Format a node with its shape syntax */
export function formatNodeSyntax(node: FlowNode): string {
  const cleanLabel = sanitizeLabel(node.label) || node.id;
  switch (node.shape) {
    case "diamond":
      return `${node.id}{"${cleanLabel}"}`;
    case "round":
      return `${node.id}(["${cleanLabel}"])`;
    case "database":
      return `${node.id}[("${cleanLabel}")]`;
    case "rect":
    default:
      return `${node.id}["${cleanLabel}"]`;
  }
}

/** Generate a complete Flowchart */
export function generateFlowchart(options: FlowchartOptions): string {
  const { direction, nodes, title } = options;
  let lines: string[] = [`flowchart ${direction}`];

  if (title) {
    const cleanTitle = sanitizeLabel(title);
    if (cleanTitle) {
      lines.push(`    %% Title: ${cleanTitle}`);
    }
  }

  // Declare nodes
  for (const node of nodes) {
    lines.push(`    ${formatNodeSyntax(node)}`);
  }

  // Declare connections
  const hasCustomBranches = nodes.some((n) => n.branches && n.branches.length > 0);

  if (hasCustomBranches) {
    for (const node of nodes) {
      if (node.branches) {
        for (const branch of node.branches) {
          const edgeLabel = branch.label ? `|"${sanitizeLabel(branch.label)}"|` : "";
          lines.push(`    ${node.id} -->${edgeLabel} ${branch.targetId}`);
        }
      }
    }
  } else {
    // Default linear chain if no explicit branches defined
    for (let i = 0; i < nodes.length - 1; i++) {
      lines.push(`    ${nodes[i].id} --> ${nodes[i + 1].id}`);
    }
  }

  return lines.join("\n");
}

/** Generate Sequence Diagram */
export function generateSequenceDiagram(options: SequenceOptions): string {
  const { participants, messages, title } = options;
  const lines: string[] = ["sequenceDiagram"];

  lines.push("    autonumber");

  // Participants
  for (const p of participants) {
    const cleanId = p.id.replace(/[^\w]/g, "");
    const cleanLabel = sanitizeLabel(p.label) || cleanId;
    lines.push(`    participant ${cleanId} as ${cleanLabel}`);
  }

  // Messages
  for (const m of messages) {
    const fromId = m.from.replace(/[^\w]/g, "");
    const toId = m.to.replace(/[^\w]/g, "");
    const text = sanitizeLabel(m.text) || "Message";

    let arrow = "->>";
    if (m.type === "dotted") arrow = "-->>";
    if (m.type === "fail") arrow = "-x";

    lines.push(`    ${fromId}${arrow}${toId}: ${text}`);
  }

  return lines.join("\n");
}

/** Generate Bar and/or Line Chart with dynamic axis bounds */
export function generateBarAndLineChart(options: BarLineChartOptions): string {
  const { title, mode, items, yAxisTitle = "Value" } = options;
  const cleanTitle = sanitizeLabel(title) || "Chart";

  if (!items || items.length === 0) {
    return `xychart-beta\n    title "${cleanTitle}"\n    x-axis ["Item"]\n    y-axis "Value" 0 --> 100\n    bar [0]`;
  }

  const labels = items.map((i) => `"${sanitizeLabel(i.label) || "Point"}"`).join(", ");
  const barValues = items.map((i) => Number(i.value) || 0);
  const lineValues = items.map((i) => (i.lineValue !== undefined ? Number(i.lineValue) || 0 : Number(i.value) || 0));

  // Calculate dynamic max value with 20% headroom
  const allValues = mode === "both" ? [...barValues, ...lineValues] : mode === "line" ? lineValues : barValues;
  const rawMax = Math.max(...allValues, 10);
  const rawMin = Math.min(...allValues, 0);

  // Round max up to nice round number
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const yMax = Math.ceil((rawMax * 1.2) / magnitude) * magnitude;
  const yMin = rawMin < 0 ? Math.floor(rawMin * 1.2) : 0;

  const lines: string[] = [
    "xychart-beta",
    `    title "${cleanTitle}"`,
    `    x-axis [${labels}]`,
    `    y-axis "${sanitizeLabel(yAxisTitle)}" ${yMin} --> ${yMax}`,
  ];

  if (mode === "bar" || mode === "both") {
    lines.push(`    bar [${barValues.join(", ")}]`);
  }
  if (mode === "line" || mode === "both") {
    lines.push(`    line [${lineValues.join(", ")}]`);
  }

  return lines.join("\n");
}

/** Generate Pie Chart */
export function generatePieChart(options: PieOptions): string {
  const { title, items } = options;
  const cleanTitle = sanitizeLabel(title) || "Summary";

  const lines: string[] = [`pie title ${cleanTitle}`];
  for (const item of items) {
    const label = sanitizeLabel(item.label) || "Slice";
    const val = Math.max(Number(item.value) || 1, 0.01);
    lines.push(`    "${label}" : ${val}`);
  }

  return lines.join("\n");
}

/** Generate Mindmap */
export function generateMindmap(options: MindmapOptions): string {
  const { root, branches } = options;
  const cleanRoot = sanitizeLabel(root) || "Concept";

  const lines: string[] = ["mindmap", `  root(("${cleanRoot}"))`];

  for (const b of branches) {
    const bLabel = sanitizeLabel(b.label) || "Topic";
    lines.push(`    ["${bLabel}"]`);
    if (b.subBranches && b.subBranches.length > 0) {
      for (const sub of b.subBranches) {
        const subLabel = sanitizeLabel(sub);
        if (subLabel) {
          lines.push(`      ("${subLabel}")`);
        }
      }
    }
  }

  return lines.join("\n");
}

/** Generate State Diagram */
export function generateStateDiagram(options: StateDiagramOptions): string {
  const { transitions } = options;
  const lines: string[] = ["stateDiagram-v2"];

  for (const t of transitions) {
    const from = t.from.trim();
    const to = t.to.trim();
    const label = t.label ? `: ${sanitizeLabel(t.label)}` : "";
    lines.push(`    ${from} --> ${to}${label}`);
  }

  return lines.join("\n");
}

export const COLOR_PALETTES = [
  { key: "indigo", name: { en: "Indigo Flow", th: "อินดิโก้ / น้ำเงินคราม" }, primary: "#6366f1", bg: "bg-indigo-500" },
  { key: "emerald", name: { en: "Emerald Mint", th: "เขียวมินต์" }, primary: "#10b981", bg: "bg-emerald-500" },
  { key: "sky", name: { en: "Ocean Sky", th: "ฟ้าน้ำทะเล" }, primary: "#0ea5e9", bg: "bg-sky-500" },
  { key: "amber", name: { en: "Warm Amber", th: "ส้มอำพัน" }, primary: "#f59e0b", bg: "bg-amber-500" },
  { key: "purple", name: { en: "Neon Purple", th: "ม่วงนีออน" }, primary: "#a855f7", bg: "bg-purple-500" },
  { key: "rose", name: { en: "Berry Rose", th: "ชมพูเบอร์รี่" }, primary: "#f43f5e", bg: "bg-rose-500" },
  { key: "slate", name: { en: "Clean Slate", th: "เทาคลาสสิก" }, primary: "#94a3b8", bg: "bg-slate-400" },
];

/** Attach a theme directive to Mermaid code */
export function attachThemeDirective(chartCode: string, paletteKey: string): string {
  // If the chart is xychart-beta, themeVariables can sometimes interfere with syntax in older engines,
  // so we keep it clean or use standard directive
  const palette = COLOR_PALETTES.find((p) => p.key === paletteKey) || COLOR_PALETTES[0];

  const directive = `%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '${palette.primary}', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '${palette.primary}', 'lineColor': '${palette.primary}', 'secondaryColor': '${palette.primary}'}}}%%`;

  return `${directive}\n${chartCode}`;
}
