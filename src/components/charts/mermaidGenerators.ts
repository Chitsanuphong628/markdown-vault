/**
 * Pure generator functions for generating clean, syntax-valid Mermaid diagrams
 * with proper escaping, dynamic axis scaling, and theme directives.
 */

export interface FlowNode {
  id: string;
  label: string;
  shape: "rect" | "round" | "diamond" | "database";
  tone?: FlowNodeTone;
  /** Optional custom outgoing connections (e.g. Yes/No branches from a decision) */
  branches?: Array<{ targetId: string; label?: string }>;
}

export type FlowNodeTone = "start" | "process" | "decision" | "data" | "success" | "warning" | "danger";

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
  purpose?: string;
  subBranches?: string[];
}

export interface MindmapOptions {
  root: string;
  branches: MindmapBranch[];
  purposeLabel?: string;
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
  const lines: string[] = [`flowchart ${direction}`];

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

  // Keep the ordinary path connected when a decision introduces branches.
  const nodeIds = new Set(nodes.map(node => node.id));
  const siblingOutcomes = nodes.map(node => new Set(
    (node.branches || []).map(branch => branch.targetId).filter(id => nodeIds.has(id)),
  ));
  const links: Array<{ from: string; to: string; label?: string }> = [];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const branches = (node.branches || []).filter(branch => nodeIds.has(branch.targetId));
    if (branches.length) {
      for (const branch of branches) {
        links.push({ from: node.id, to: branch.targetId, label: branch.label });
      }
      continue;
    }
    const next = nodes[index + 1];
    if (next && !siblingOutcomes.some(group => group.has(node.id) && group.has(next.id))) {
      links.push({ from: node.id, to: next.id });
    }
  }

  for (const link of links) {
    const edgeLabel = link.label ? `|"${sanitizeLabel(link.label)}"|` : "";
    lines.push(`    ${link.from} -->${edgeLabel} ${link.to}`);
  }

  for (const definition of FLOWCHART_CLASS_DEFINITIONS) lines.push(`    ${definition}`);
  for (const node of nodes) {
    const tone = node.tone || toneForShape(node.shape);
    lines.push(`    class ${node.id} flow${capitalize(tone)}`);
  }
  links.forEach((link, index) => {
    const tone = toneForBranchLabel(link.label);
    if (tone) {
      const color = FLOW_NODE_STYLES[tone].stroke;
      lines.push(`    linkStyle ${index} stroke:${color},color:${color},stroke-width:2px;`);
    }
  });

  return lines.join("\n");
}

const FLOW_NODE_STYLES: Record<FlowNodeTone, { fill: string; stroke: string; text: string }> = {
  start: { fill: "#12352f", stroke: "#2dd4bf", text: "#f0fdfa" },
  process: { fill: "#172b44", stroke: "#60a5fa", text: "#eff6ff" },
  decision: { fill: "#3a2c14", stroke: "#fbbf24", text: "#fffbeb" },
  data: { fill: "#282144", stroke: "#a78bfa", text: "#f5f3ff" },
  success: { fill: "#12352f", stroke: "#34d399", text: "#ecfdf5" },
  warning: { fill: "#3a2c14", stroke: "#fbbf24", text: "#fffbeb" },
  danger: { fill: "#3d1e2a", stroke: "#fb7185", text: "#fff1f2" },
};

export const FLOWCHART_CLASS_DEFINITIONS = Object.entries(FLOW_NODE_STYLES).map(([tone, style]) =>
  `classDef flow${capitalize(tone)} fill:${style.fill},stroke:${style.stroke},stroke-width:2px,color:${style.text};`,
);

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toneForShape(shape: FlowNode["shape"]): FlowNodeTone {
  if (shape === "round") return "start";
  if (shape === "diamond") return "decision";
  if (shape === "database") return "data";
  return "process";
}

function toneForBranchLabel(label = ""): "success" | "danger" | undefined {
  const value = label.trim();
  const englishToken = (words: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${words})(?:$|[^\\p{L}\\p{N}])`, "iu");
  if (/(ไม่|ปฏิเสธ|ผิด)/u.test(value) || englishToken("no|not|fail(?:ed|ure)?|invalid|reject(?:ed)?|error").test(value)) {
    return "danger";
  }
  if (/(ใช่|ถูก|ผ่าน|สำเร็จ)/u.test(value) || englishToken("yes|valid|pass(?:ed)?|success|approved").test(value)) {
    return "success";
  }
  return undefined;
}

/** Generate Sequence Diagram */
export function generateSequenceDiagram(options: SequenceOptions): string {
  const { participants, messages } = options;
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
  const purposeLabel = sanitizeMindmapText(options.purposeLabel || "ทำเพื่อ") || "ทำเพื่อ";
  const cleanRoot = sanitizeLabel(root) || "Concept";

  const lines: string[] = ["mindmap", `  root(("${cleanRoot}"))`];

  for (const [branchIndex, b] of branches.entries()) {
    const branchId = `branch${branchIndex}`;
    const bLabel = sanitizeMindmapText(b.label) || "Topic";
    const purpose = sanitizeMindmapText(b.purpose || "");
    const branchText = purpose
      ? `**${bLabel}**\n*${purposeLabel} · ${purpose}*`
      : `**${bLabel}**`;
    lines.push(`    ${branchId}["\`${branchText}\`"]`);
    lines.push("    :::main-branch");
    if (b.subBranches && b.subBranches.length > 0) {
      for (const [subIndex, sub] of b.subBranches.entries()) {
        const subLabel = sanitizeMindmapText(sub);
        if (subLabel) {
          lines.push(`      sub${branchIndex}_${subIndex}("${subLabel}")`);
          lines.push("      :::leaf");
        }
      }
    }
  }

  return lines.join("\n");
}

function sanitizeMindmapText(text: string): string {
  return sanitizeLabel(text).replace(/[\\`*_]/g, " ").replace(/\s+/g, " ").trim();
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
  { key: "indigo", name: { en: "Indigo", th: "คราม" }, primary: "#6366f1", bg: "bg-indigo-500" },
  { key: "emerald", name: { en: "Emerald", th: "เขียว" }, primary: "#10b981", bg: "bg-emerald-500" },
  { key: "sky", name: { en: "Sky", th: "ฟ้า" }, primary: "#0ea5e9", bg: "bg-sky-500" },
  { key: "amber", name: { en: "Amber", th: "อำพัน" }, primary: "#f59e0b", bg: "bg-amber-500" },
  { key: "purple", name: { en: "Purple", th: "ม่วง" }, primary: "#a855f7", bg: "bg-purple-500" },
  { key: "rose", name: { en: "Rose", th: "ชมพู" }, primary: "#f43f5e", bg: "bg-rose-500" },
  { key: "slate", name: { en: "Slate", th: "เทา" }, primary: "#94a3b8", bg: "bg-slate-400" },
];

/** Attach a theme directive to Mermaid code */
export function attachThemeDirective(chartCode: string, paletteKey: string): string {
  // If the chart is xychart-beta, themeVariables can sometimes interfere with syntax in older engines,
  // so we keep it clean or use standard directive
  const palette = COLOR_PALETTES.find((p) => p.key === paletteKey) || COLOR_PALETTES[0];

  const directive = `%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '${palette.primary}', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '${palette.primary}', 'lineColor': '${palette.primary}', 'secondaryColor': '${palette.primary}'}}}%%`;

  return `${directive}\n${chartCode}`;
}

const MINDMAP_COLORS = ["#2563eb", "#0f766e", "#b45309", "#6d28d9"];
export const MERMAID_EXPORT_BACKGROUND = "#161922";

export function addSvgBackground(svgMarkup: string, color = MERMAID_EXPORT_BACKGROUND): string {
  if (!/^#[\da-f]{6}$/iu.test(color)) return svgMarkup;
  const openingTag = /<svg\b[^>]*>/iu.exec(svgMarkup);
  if (!openingTag) return svgMarkup;

  const viewBox = /\bviewBox=["']([^"']+)["']/iu.exec(openingTag[0])?.[1];
  const dimensions = viewBox?.trim().split(/[\s,]+/u).map(Number);
  const [x, y, width, height] = dimensions?.length === 4 && dimensions.every(Number.isFinite)
    ? dimensions
    : [0, 0, 800, 600];
  if (width <= 0 || height <= 0) return svgMarkup;

  const background = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" data-mermaid-background="true"/>`;
  const insertAt = openingTag.index + openingTag[0].length;
  return `${svgMarkup.slice(0, insertAt)}${background}${svgMarkup.slice(insertAt)}`;
}

const MINDMAP_THEME_CSS = [
  ".mindmap-node.section-root circle,.mindmap-node.section-root rect,.mindmap-node.section-root path{fill:#24234b;stroke:#818cf8;stroke-width:3px}",
  ".mindmap-node.main-branch rect,.mindmap-node.main-branch path,.mindmap-node.main-branch circle,.mindmap-node.main-branch polygon{stroke-width:2px}",
  ".mindmap-node.leaf rect,.mindmap-node.leaf path,.mindmap-node.leaf circle,.mindmap-node.leaf polygon{fill:#151a26;stroke:#354052;stroke-width:1.5px}",
  ".mindmap-node.leaf text,.mindmap-node.leaf span{fill:#dbe4f0;color:#dbe4f0}",
  "path.edge-depth-1{stroke-width:2.5px!important}",
  "path.edge-depth-2,path.edge-depth-3,path.edge-depth-4,path.edge-depth-5,path.edge-depth-6,path.edge-depth-7,path.edge-depth-8{stroke-width:1.5px!important}",
].join(" ");

export function attachMindmapThemeDirective(chartCode: string): string {
  const colorVariables = Array.from({ length: 12 }, (_, index) => {
    const color = MINDMAP_COLORS[index % MINDMAP_COLORS.length];
    return `'cScale${index}':'${color}','cScaleLabel${index}':'#ffffff','cScaleInv${index}':'${color}'`;
  }).join(",");
  const directive = `%%{init: {'theme': 'base','look':'neo','darkMode':true,'themeVariables': {'background':'${MERMAID_EXPORT_BACKGROUND}','mainBkg':'#151a26','primaryColor':'#24234b','primaryTextColor':'#f3f4f6','textColor':'#f3f4f6','nodeBorder':'#475569',${colorVariables}},'themeCSS':'${MINDMAP_THEME_CSS}','mindmap':{'padding':24,'maxNodeWidth':240}}}%%`;
  return `${directive}\n${chartCode}`;
}

export function attachFlowchartThemeDirective(chartCode: string): string {
  const directive = `%%{init: {'theme':'base','flowchart':{'curve':'basis'},'themeVariables':{'background':'${MERMAID_EXPORT_BACKGROUND}','mainBkg':'#172b44','primaryColor':'#172b44','primaryTextColor':'#f3f4f6','lineColor':'#64748b','nodeBorder':'#60a5fa','textColor':'#f3f4f6'}}}%%`;
  return `${directive}\n${chartCode}`;
}
