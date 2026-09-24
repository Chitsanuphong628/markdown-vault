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
  assert.match(chart, /\["Security"\]/);
  assert.match(chart, /\("Session Version"\)/);
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

test("DIAGRAM_TEMPLATES contains 8 complete, valid curated templates", () => {
  assert.equal(DIAGRAM_TEMPLATES.length, 8);

  for (const t of DIAGRAM_TEMPLATES) {
    assert.ok(t.id.length > 0, "Template ID missing");
    assert.ok(t.name.en.length > 0, "EN Name missing");
    assert.ok(t.name.th.length > 0, "TH Name missing");
    assert.ok(t.badge.length > 0, "Badge missing");
    assert.ok(t.mermaidCode.trim().length > 20, `Template ${t.id} code is too short`);
  }
});
