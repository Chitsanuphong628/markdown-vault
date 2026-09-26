import test from "node:test";
import assert from "node:assert/strict";
import {
  generateFlowchart,
  generateSequenceDiagram,
  generateBarAndLineChart,
  generatePieChart,
  generateMindmap,
  generateStateDiagram,
  sanitizeLabel,
  attachThemeDirective,
  attachMindmapThemeDirective,
  attachFlowchartThemeDirective,
  addSvgBackground,
  MERMAID_EXPORT_BACKGROUND,
  FlowNode,
} from "../src/components/charts/mermaidGenerators";
import { DIAGRAM_TEMPLATES } from "../src/components/charts/diagramTemplates";

test("sanitizeLabel removes breaking quotes and brackets while preserving text", () => {
  const dirty = 'User [Admin] {Special} "Quote" (Test)';
  const clean = sanitizeLabel(dirty);
  assert.equal(clean, "User Admin Special 'Quote' Test");
  assert.equal(sanitizeLabel(""), "");
});

test("generateFlowchart produces valid syntax with decision branches and custom node shapes", () => {
  const nodes: FlowNode[] = [
    { id: "Start", label: "เริ่มต้น", shape: "round" },
    {
      id: "Check",
      label: "ตรวจสอบสิทธิ์?",
      shape: "diamond",
      branches: [
        { targetId: "Pass", label: "ผ่าน" },
        { targetId: "Fail", label: "ไม่ผ่าน" },
      ],
    },
    { id: "DB", label: "บันทึกฐานข้อมูล", shape: "database" },
    { id: "Pass", label: "สำเร็จ", shape: "rect" },
    { id: "Fail", label: "ปฏิเสธ", shape: "rect" },
  ];

  const chart = generateFlowchart({
    title: "ระบบตรวจสอบสิทธิ์",
    direction: "TD",
    nodes,
  });

  assert.match(chart, /^flowchart TD/);
  assert.match(chart, /Start\(\["เริ่มต้น"\]\)/);
  assert.match(chart, /Check\{"ตรวจสอบสิทธิ์\?"\}/);
  assert.match(chart, /DB\[\("บันทึกฐานข้อมูล"\)\]/);
  assert.match(chart, /Check -->\|"ผ่าน"\| Pass/);
  assert.match(chart, /Check -->\|"ไม่ผ่าน"\| Fail/);
  assert.match(chart, /class Check flowDecision/);
  assert.match(chart, /classDef flowDecision/);
});

test("generateFlowchart assigns readable semantic tones and colors yes/no paths", () => {
  const chart = generateFlowchart({
    direction: "TD",
    nodes: [
      { id: "Start", label: "เริ่ม", shape: "round" },
      { id: "Check", label: "พร้อมหรือไม่", shape: "diamond", branches: [
        { targetId: "Done", label: "ใช่" },
        { targetId: "Help", label: "ไม่" },
      ] },
      { id: "Done", label: "เสร็จ", shape: "round", tone: "success" },
      { id: "Help", label: "แก้ปัญหา", shape: "rect", tone: "danger" },
    ],
  });

  assert.match(chart, /class Start flowStart/);
  assert.match(chart, /class Check flowDecision/);
  assert.match(chart, /class Done flowSuccess/);
  assert.match(chart, /class Help flowDanger/);
  assert.match(chart, /linkStyle 1 stroke:#34d399,color:#34d399/);
  assert.match(chart, /linkStyle 2 stroke:#fb7185,color:#fb7185/);
});

test("flowchart edge colors do not infer yes or no from substrings in ordinary words", () => {
  const ordinaryLabels = generateFlowchart({
    direction: "TD",
    nodes: [
      { id: "Check", label: "Check", shape: "diamond", branches: [
        { targetId: "Innovation", label: "Innovation" },
        { targetId: "Knowledge", label: "Knowledge" },
      ] },
      { id: "Innovation", label: "Innovation", shape: "rect" },
      { id: "Knowledge", label: "Knowledge", shape: "rect" },
    ],
  });
  assert.doesNotMatch(ordinaryLabels, /linkStyle/);

  const semanticLabels = generateFlowchart({
    direction: "TD",
    nodes: [
      { id: "Check", label: "Check", shape: "diamond", branches: [
        { targetId: "Reject", label: "No" },
        { targetId: "Accept", label: "Yes" },
      ] },
      { id: "Reject", label: "Reject", shape: "rect" },
      { id: "Accept", label: "Accept", shape: "rect" },
    ],
  });
  assert.match(semanticLabels, /linkStyle 0 stroke:#fb7185,color:#fb7185/);
  assert.match(semanticLabels, /linkStyle 1 stroke:#34d399,color:#34d399/);
});

test("flowchart connects steps around a decision without joining sibling outcomes", () => {
  const chart = generateFlowchart({
    direction: "TD",
    nodes: [
      { id: "Start", label: "Start", shape: "round" },
      { id: "Input", label: "Input", shape: "rect" },
      { id: "Check", label: "Check", shape: "diamond", branches: [
        { targetId: "Reject", label: "No" },
        { targetId: "Accept", label: "Yes" },
      ] },
      { id: "Reject", label: "Reject", shape: "rect" },
      { id: "Accept", label: "Accept", shape: "rect" },
      { id: "End", label: "End", shape: "round" },
    ],
  });
  assert.match(chart, /Start --> Input/);
  assert.match(chart, /Input --> Check/);
  assert.match(chart, /Check -->\|"No"\| Reject/);
  assert.match(chart, /Check -->\|"Yes"\| Accept/);
  assert.doesNotMatch(chart, /Reject --> Accept/);
  assert.match(chart, /Accept --> End/);
});

test("flowchart ignores branch targets that no longer exist", () => {
  const chart = generateFlowchart({
    direction: "LR",
    nodes: [
      { id: "Check", label: "Check", shape: "diamond", branches: [
        { targetId: "Missing", label: "Old" },
        { targetId: "End", label: "Yes" },
      ] },
      { id: "End", label: "End", shape: "round" },
    ],
  });
  assert.doesNotMatch(chart, /Missing/);
  assert.match(chart, /Check -->\|"Yes"\| End/);
});

test("generateSequenceDiagram produces valid sequence with participants and arrow types", () => {
  const chart = generateSequenceDiagram({
    title: "API Flow",
    participants: [
      { id: "Client", label: "เว็บเบราว์เซอร์" },
      { id: "API", label: "Next.js API" },
      { id: "DB", label: "Supabase DB" },
    ],
    messages: [
      { from: "Client", to: "API", text: "GET /api/notes", type: "solid" },
      { from: "API", to: "DB", text: "SELECT * FROM Note", type: "solid" },
      { from: "DB", to: "API", text: "200 OK Notes Data", type: "dotted" },
      { from: "API", to: "Client", text: "Auth Error", type: "fail" },
    ],
  });

  assert.match(chart, /^sequenceDiagram/);
  assert.match(chart, /autonumber/);
  assert.match(chart, /participant Client as เว็บเบราว์เซอร์/);
  assert.match(chart, /Client->>API: GET \/api\/notes/);
  assert.match(chart, /DB-->>API: 200 OK Notes Data/);
  assert.match(chart, /API-xClient: Auth Error/);
});

test("generateBarAndLineChart calculates dynamic Y-axis bounds instead of hardcoding 0-100", () => {
  const chart = generateBarAndLineChart({
    title: "High Volume Metrics",
    mode: "both",
    items: [
      { label: "Q1", value: 350, lineValue: 300 },
      { label: "Q2", value: 750, lineValue: 800 },
      { label: "Q3", value: 1200, lineValue: 1100 },
    ],
  });

  assert.match(chart, /^xychart-beta/);
  assert.match(chart, /title "High Volume Metrics"/);
  assert.match(chart, /x-axis \["Q1", "Q2", "Q3"\]/);
  // Max value is 1200, so yMax must scale well above 100 (e.g. 1500, 2000)
  assert.match(chart, /y-axis "Value" 0 --> [1-9][0-9]{3}/);
  assert.match(chart, /bar \[350, 750, 1200\]/);
  assert.match(chart, /line \[300, 800, 1100\]/);
});

test("generatePieChart produces pie title and slices", () => {
  const chart = generatePieChart({
    title: "Budget 2026",
    items: [
      { label: "Dev", value: 60 },
      { label: "Ops", value: 40 },
    ],
  });

  assert.match(chart, /^pie title Budget 2026/);
  assert.match(chart, /"Dev" : 60/);
  assert.match(chart, /"Ops" : 40/);
});

test("generateMindmap produces multi-level hierarchy", () => {
  const chart = generateMindmap({
    root: "Nota Vault",
    branches: [
      {
        label: "Security",
        subBranches: ["Session Version", "RLS"],
      },
      {
        label: "Editor",
        subBranches: ["Mermaid", "Tiptap"],
      },
    ],
  });

  assert.match(chart, /^mindmap/);
  assert.match(chart, /root\(\("Nota Vault"\)\)/);
  assert.match(chart, /branch0\["`\*\*Security\*\*`"\]/);
  assert.match(chart, /sub0_0\("Session Version"\)/);
});

test("generateMindmap includes a purpose line under each main topic and styles descendants as leaves", () => {
  const chart = generateMindmap({
    root: "โครงการ",
    branches: [
      { label: "เป้าหมาย", purpose: "ลดเวลาทำงาน", subBranches: ["ค้นหาง่าย", "บันทึกเร็ว"] },
      { label: "Research", purpose: "หาเหตุผล", subBranches: ["ไทย", "English"] },
    ],
  });

  assert.match(chart, /branch0\["`\*\*เป้าหมาย\*\*\n\*ทำเพื่อ · ลดเวลาทำงาน\*`"\]/);
  assert.match(chart, /branch1\["`\*\*Research\*\*\n\*ทำเพื่อ · หาเหตุผล\*`"\]/);
  assert.match(chart, /sub0_0\("ค้นหาง่าย"\)/);
  assert.match(chart, /:::leaf/);
});

test("generateMindmap localizes the optional purpose label", () => {
  const chart = generateMindmap({
    root: "Project",
    purposeLabel: "Purpose",
    branches: [{ label: "Goals", purpose: "reduce review time" }],
  });

  assert.match(chart, /\*Purpose · reduce review time\*/);
  assert.doesNotMatch(chart, /ทำเพื่อ/);
});

test("generateMindmap handles an empty purpose and a full eight-branch palette", () => {
  const branches = Array.from({ length: 8 }, (_, index) => ({
    label: `หัวข้อ ${index + 1}`,
    purpose: index === 0 ? "" : `Purpose ${index + 1}`,
    subBranches: [`รายละเอียด ${index + 1}`],
  }));
  const chart = generateMindmap({ root: "แผน", branches });

  assert.match(chart, /branch0\["`\*\*หัวข้อ 1\*\*`"\]/);
  assert.doesNotMatch(chart, /ทำเพื่อ ·  /);
  assert.match(chart, /branch7\["`\*\*หัวข้อ 8\*\*\n\*ทำเพื่อ · Purpose 8\*`"\]/);
  assert.equal((chart.match(/:::main-branch/g) || []).length, 8);
});

test("generateMindmap keeps special characters in purpose tags from changing Mermaid structure", () => {
  const chart = generateMindmap({
    root: "แผน",
    branches: [{ label: "หัวข้อ", purpose: "`code` **bold** [details]\nnext line" }],
  });

  assert.match(chart, /ทำเพื่อ · code bold details next line/);
  assert.equal((chart.match(/\n/g) || []).length, 4);
});

test("generateStateDiagram produces valid state machine transitions", () => {
  const chart = generateStateDiagram({
    transitions: [
      { from: "[*]", to: "Draft", label: "create" },
      { from: "Draft", to: "Review", label: "submit" },
      { from: "Review", to: "[*]", label: "reject" },
    ],
  });

  assert.match(chart, /^stateDiagram-v2/);
  assert.match(chart, /\[\*\] --> Draft: create/);
  assert.match(chart, /Draft --> Review: submit/);
});

test("attachThemeDirective prefixes chart with init themeVariables directive", () => {
  const raw = "flowchart LR\n    A --> B";
  const withTheme = attachThemeDirective(raw, "emerald");

  assert.match(withTheme, /%%\{init: \{'theme': 'dark'/);
  assert.match(withTheme, /#10b981/);
  assert.match(withTheme, /flowchart LR\n    A --> B$/);
});

test("generated mindmap and workflow use their own high-contrast curved themes", () => {
  const mindmap = attachMindmapThemeDirective("mindmap\n  root((Topic))");
  const workflow = attachFlowchartThemeDirective("flowchart TD\n  Start --> End");

  assert.match(mindmap, /'theme': 'base'/);
  assert.match(mindmap, /'cScale0':'#2563eb'/);
  assert.match(mindmap, /mindmap-node\.leaf/);
  assert.match(mindmap, /edge-depth-1\{stroke-width:2\.5px!important\}/);
  assert.match(mindmap, /'background':'#161922'/);
  assert.match(workflow, /'background':'#161922'/);
  assert.match(workflow, /'curve':'basis'/);
  assert.match(workflow, /'theme':'base'/);
});

test("SVG export background follows the diagram canvas and its viewBox", () => {
  const svg = '<svg viewBox="-8 -4 320.5 180"><path d="M0 0"/></svg>';
  const rendered = addSvgBackground(svg, MERMAID_EXPORT_BACKGROUND);

  assert.match(rendered, /<rect x="-8" y="-4" width="320\.5" height="180" fill="#161922" data-mermaid-background="true"\/>/);
  assert.ok(rendered.indexOf("data-mermaid-background") < rendered.indexOf("<path"));
});

test("DIAGRAM_TEMPLATES contains 8 complete, valid curated templates", () => {
  assert.equal(DIAGRAM_TEMPLATES.length, 8);

  for (const t of DIAGRAM_TEMPLATES) {
    assert.ok(t.id.length > 0, "Template ID missing");
    assert.ok(t.name.en.length > 0, "EN Name missing");
    assert.ok(t.name.th.length > 0, "TH Name missing");
    assert.ok(t.badge.length > 0, "Badge missing");
    assert.ok(t.mermaidCode.trim().length > 20, `Template ${t.id} code is too short`);
  }

  assert.match(DIAGRAM_TEMPLATES.find((template) => template.id === "auth-flow")!.mermaidCode, /class Alert flowDanger/);
  assert.match(DIAGRAM_TEMPLATES.find((template) => template.id === "feature-mindmap")!.mermaidCode, /ทำเพื่อ ·/);
});
