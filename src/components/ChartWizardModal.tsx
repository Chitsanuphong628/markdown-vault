"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  BarChart2,
  PieChart,
  GitFork,
  Network,
  Plus,
  Trash2,
  Check,
  Palette,
  Eye,
  LayoutTemplate,
  Code,
  ArrowRight,
  Sliders,
  Layers,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import MermaidChart from "@/components/MermaidChart";
import { Language } from "@/lib/i18n";
import {
  generateFlowchart,
  generateSequenceDiagram,
  generateBarAndLineChart,
  generatePieChart,
  generateMindmap,
  generateStateDiagram,
  attachThemeDirective,
  COLOR_PALETTES,
  FlowNode,
  SequenceMessage,
} from "./charts/mermaidGenerators";
import { DIAGRAM_TEMPLATES, DiagramTemplate } from "./charts/diagramTemplates";

interface ChartWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertChart: (markdown: string) => void;
  lang: Language;
}

type StudioTab = "visual" | "templates" | "code";
type VisualType = "flowchart" | "sequence" | "bar" | "pie" | "mindmap" | "state";

export default function ChartWizardModal({
  isOpen,
  onClose,
  onInsertChart,
  lang,
}: ChartWizardModalProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>("visual");
  const [visualType, setVisualType] = useState<VisualType>("flowchart");
  const [activePalette, setActivePalette] = useState(COLOR_PALETTES[0].key);

  // Common metadata
  const [title, setTitle] = useState(lang === "th" ? "ผังกระบวนการทำงาน" : "Process Flow");

  // 1. Flowchart State
  const [flowDirection, setFlowDirection] = useState<"TD" | "LR">("TD");
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([
    { id: "Start", label: lang === "th" ? "เริ่มต้น (Start)" : "Start", shape: "round" },
    { id: "Input", label: lang === "th" ? "กรอกข้อมูลและส่งคำขอ" : "Submit Request", shape: "rect" },
    {
      id: "Check",
      label: lang === "th" ? "ตรวจสอบข้อมูลถูกต้อง?" : "Validate Data?",
      shape: "diamond",
      branches: [
        { targetId: "Alert", label: lang === "th" ? "ไม่ถูกต้อง" : "Invalid" },
        { targetId: "Save", label: lang === "th" ? "ถูกต้อง" : "Valid" },
      ],
    },
    { id: "Alert", label: lang === "th" ? "แจ้งเตือนข้อผิดพลาด" : "Display Error", shape: "rect" },
    { id: "Save", label: lang === "th" ? "บันทึกข้อมูลลงระบบ" : "Save Record", shape: "database" },
    { id: "End", label: lang === "th" ? "เสร็จสิ้น (Finish)" : "Done", shape: "round" },
  ]);

  // 2. Sequence State
  const [seqParticipants, setSeqParticipants] = useState<Array<{ id: string; label: string }>>([
    { id: "User", label: lang === "th" ? "ผู้ใช้ (Client)" : "User" },
    { id: "API", label: lang === "th" ? "Next.js API" : "Backend API" },
    { id: "DB", label: lang === "th" ? "Supabase DB" : "Database" },
  ]);
  const [seqMessages, setSeqMessages] = useState<SequenceMessage[]>([
    { from: "User", to: "API", text: lang === "th" ? "POST /api/notes (บันทึกโน้ต)" : "Save Note Request", type: "solid" },
    { from: "API", to: "DB", text: lang === "th" ? "INSERT / UPDATE Note" : "Database Write", type: "solid" },
    { from: "DB", to: "API", text: lang === "th" ? "200 OK (สำเร็จ)" : "Success Response", type: "dotted" },
    { from: "API", to: "User", text: lang === "th" ? "แสดงผลบันทึกสำเร็จ" : "Display Toast Notification", type: "dotted" },
  ]);

  // 3. Bar / Line State
  const [chartMode, setChartMode] = useState<"bar" | "line" | "both">("bar");
  const [chartItems, setChartItems] = useState([
    { label: lang === "th" ? "ไตรมาส 1" : "Quarter 1", value: 35, lineValue: 40 },
    { label: lang === "th" ? "ไตรมาส 2" : "Quarter 2", value: 65, lineValue: 60 },
    { label: lang === "th" ? "ไตรมาส 3" : "Quarter 3", value: 90, lineValue: 80 },
    { label: lang === "th" ? "ไตรมาส 4" : "Quarter 4", value: 125, lineValue: 110 },
  ]);

  // 4. Pie State
  const [pieItems, setPieItems] = useState([
    { label: lang === "th" ? "งานพัฒนาและวิศวกรรม" : "Engineering", value: 45 },
    { label: lang === "th" ? "งานออกแบบ UI/UX" : "Design & UX", value: 20 },
    { label: lang === "th" ? "การตลาดและการเปิดตัว" : "Marketing", value: 20 },
    { label: lang === "th" ? "การดูแลโครงสร้างพื้นฐาน" : "Infrastructure", value: 15 },
  ]);

  // 5. Mindmap State
  const [mindmapRoot, setMindmapRoot] = useState(lang === "th" ? "Nota Vault" : "Core Project");
  const [mindmapBranches, setMindmapBranches] = useState([
    {
      label: lang === "th" ? "ความปลอดภัย (Security)" : "Security",
      subBranches: [lang === "th" ? "Session Revocation" : "Session Tokens", lang === "th" ? "Row Level Security" : "RLS Policies"],
    },
    {
      label: lang === "th" ? "ระบบชาร์ตและผังงาน" : "Chart Studio",
      subBranches: [lang === "th" ? "Decision Flowcharts" : "Decision Nodes", lang === "th" ? "PNG/SVG Export" : "Retina Export"],
    },
    {
      label: lang === "th" ? "ประสิทธิภาพ (Performance)" : "Performance",
      subBranches: [lang === "th" ? "In-Memory Session Cache" : "Memory Cache", lang === "th" ? "Covering Indexes" : "Covering Indexes"],
    },
  ]);

  // 6. State Machine State
  const [stateTransitions, setStateTransitions] = useState([
    { from: "[*]", to: "Draft", label: lang === "th" ? "สร้างเอกสาร" : "New Document" },
    { from: "Draft", to: "Review", label: lang === "th" ? "ส่งตรวจสอบ" : "Submit for Review" },
    { from: "Review", to: "Draft", label: lang === "th" ? "ขอปรับปรุง" : "Changes Requested" },
    { from: "Review", to: "Approved", label: lang === "th" ? "อนุมัติ" : "Approved" },
    { from: "Approved", to: "Published", label: lang === "th" ? "เผยแพร่" : "Publish" },
    { from: "Published", to: "[*]", label: lang === "th" ? "สิ้นสุด" : "Archive" },
  ]);

  // Direct Code State
  const [customCode, setCustomCode] = useState<string>("");

  // Track the generated visual code
  const generatedVisualCode = useMemo(() => {
    switch (visualType) {
      case "flowchart":
        return generateFlowchart({
          title,
          direction: flowDirection,
          nodes: flowNodes,
        });
      case "sequence":
        return generateSequenceDiagram({
          title,
          participants: seqParticipants,
          messages: seqMessages,
        });
      case "bar":
        return generateBarAndLineChart({
          title: title || (lang === "th" ? "สถิติผลงาน" : "Performance Metrics"),
          mode: chartMode,
          items: chartItems,
        });
      case "pie":
        return generatePieChart({
          title: title || (lang === "th" ? "สัดส่วนงบประมาณ" : "Budget Distribution"),
          items: pieItems,
        });
      case "mindmap":
        return generateMindmap({
          root: mindmapRoot,
          branches: mindmapBranches,
        });
      case "state":
        return generateStateDiagram({
          transitions: stateTransitions,
        });
      default:
        return "";
    }
  }, [
    visualType,
    title,
    flowDirection,
    flowNodes,
    seqParticipants,
    seqMessages,
    chartMode,
    chartItems,
    pieItems,
    mindmapRoot,
    mindmapBranches,
    stateTransitions,
    lang,
  ]);

  // Sync to customCode when switching from visual to code tab if empty or requested
  useEffect(() => {
    if (activeTab === "code" && !customCode) {
      setCustomCode(generatedVisualCode);
    }
  }, [activeTab, customCode, generatedVisualCode]);

  // Active Mermaid Code depending on tab
  const activeMermaidCode = useMemo(() => {
    if (activeTab === "code") {
      return customCode;
    }
    return attachThemeDirective(generatedVisualCode, activePalette);
  }, [activeTab, customCode, generatedVisualCode, activePalette]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: DiagramTemplate) => {
    setCustomCode(template.mermaidCode);
    setActiveTab("code");
  };

  const handleInsert = () => {
    const codeToInsert = activeTab === "code" ? customCode : generatedVisualCode;
    const markdown = `\n\`\`\`mermaid\n${codeToInsert.trim()}\n\`\`\`\n`;
    onInsertChart(markdown);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">
                  {lang === "th" ? "สตูดิโอสร้างชาร์ตและผังงาน" : "Chart & Diagram Studio"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Pro Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {lang === "th"
                  ? "ผังงานเงื่อนไขตัดสินใจ • Sequence Diagram • กราฟสถิติ • โค้ดดิบ Mermaid แบบเรียลไทม์"
                  : "Decision Flowcharts • Sequence Diagrams • Metrics Charts • Live Mermaid Editor"}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "visual"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{lang === "th" ? "ตัวสร้างภาพ (Visual)" : "Visual Builder"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "templates"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>{lang === "th" ? "คลังแม่แบบ (Templates)" : "Templates"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!customCode) setCustomCode(generatedVisualCode);
                setActiveTab("code");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "code"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>{lang === "th" ? "โค้ด Mermaid (Code)" : "Mermaid Code"}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Body: Split View (Controls Left, Live Vector Preview Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Form / Template / Code Panel */}
          <div className="lg:col-span-6 flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-950/40 overflow-y-auto p-6 space-y-6">
            {/* 1. VISUAL BUILDER TAB */}
            {activeTab === "visual" && (
              <>
                {/* Visual Type Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2.5">
                    {lang === "th" ? "เลือกรูปแบบชาร์ตและผังงาน" : "Select Diagram Type"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("flowchart");
                        setTitle(lang === "th" ? "ผังการทำงานและการตัดสินใจ" : "Decision Flowchart");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "flowchart"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <GitFork className="w-4 h-4 text-emerald-400" />
                      <span>{lang === "th" ? "ผังงาน (Flowchart)" : "Flowchart"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("sequence");
                        setTitle(lang === "th" ? "ลำดับการทำงาน (API Flow)" : "API Sequence");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "sequence"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>{lang === "th" ? "ลำดับขั้นตอน (Sequence)" : "Sequence"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("bar");
                        setTitle(lang === "th" ? "สถิติและผลงาน (Metrics)" : "Metrics Summary");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "bar"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <BarChart2 className="w-4 h-4 text-amber-400" />
                      <span>{lang === "th" ? "กราฟแท่ง/เส้น (Bar/Line)" : "Bar & Line"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("pie");
                        setTitle(lang === "th" ? "สัดส่วนงบประมาณ" : "Budget Share");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "pie"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <PieChart className="w-4 h-4 text-purple-400" />
                      <span>{lang === "th" ? "กราฟวงกลม (Pie)" : "Pie Chart"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("mindmap");
                        setTitle(lang === "th" ? "แผนผังความคิด" : "Mindmap");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "mindmap"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <Network className="w-4 h-4 text-rose-400" />
                      <span>{lang === "th" ? "ผังความคิด (Mindmap)" : "Mindmap"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVisualType("state");
                        setTitle(lang === "th" ? "สถานะการทำงาน (State)" : "State Machine");
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition-all cursor-pointer ${
                        visualType === "state"
                          ? "bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm"
                          : "bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <ArrowRight className="w-4 h-4 text-indigo-400" />
                      <span>{lang === "th" ? "สถานะระบบ (State)" : "State Machine"}</span>
                    </button>
                  </div>
                </div>

                {/* Common Title & Palette */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                      {lang === "th" ? "ชื่อหัวข้อแผนภาพ" : "Diagram Title"}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      placeholder="Enter title..."
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{lang === "th" ? "โทนสีหลัก (Palette)" : "Color Palette"}</span>
                    </label>
                    <select
                      value={activePalette}
                      onChange={(e) => setActivePalette(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                    >
                      {COLOR_PALETTES.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name[lang]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* FORM CONTROLS: FLOWCHART */}
                {visualType === "flowchart" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          {lang === "th" ? "ทิศทางผังงาน" : "Direction"}:
                        </label>
                        <button
                          type="button"
                          onClick={() => setFlowDirection("TD")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            flowDirection === "TD"
                              ? "bg-indigo-600 text-white"
                              : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                          }`}
                        >
                          บนลงล่าง (TD)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowDirection("LR")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            flowDirection === "LR"
                              ? "bg-indigo-600 text-white"
                              : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                          }`}
                        >
                          ซ้ายไปขวา (LR)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = flowNodes.length + 1;
                          setFlowNodes([
                            ...flowNodes,
                            { id: `Step${nextIdx}`, label: `ขั้นตอนใหม่ ${nextIdx}`, shape: "rect" },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มโหนด" : "Add Step"}</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {flowNodes.map((node, idx) => (
                        <div
                          key={node.id}
                          className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-neutral-500 w-6">{idx + 1}.</span>
                            <select
                              value={node.shape}
                              onChange={(e) => {
                                const updated = [...flowNodes];
                                updated[idx].shape = e.target.value as FlowNode["shape"];
                                setFlowNodes(updated);
                              }}
                              className="bg-neutral-900 border border-neutral-700/80 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                            >
                              <option value="rect">■ สี่เหลี่ยม (Process)</option>
                              <option value="diamond">◆ ข้าวหลามตัด (Decision เงื่อนไข)</option>
                              <option value="round">● วงรี (Start/End)</option>
                              <option value="database">⛁ ฐานข้อมูล (Database)</option>
                            </select>

                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const updated = [...flowNodes];
                                updated[idx].label = e.target.value;
                                setFlowNodes(updated);
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder="ข้อความในโหนด..."
                            />

                            <button
                              type="button"
                              onClick={() => setFlowNodes(flowNodes.filter((_, i) => i !== idx))}
                              disabled={flowNodes.length <= 2}
                              className="p-1 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Decision Diamond Branching Controls */}
                          {node.shape === "diamond" && (
                            <div className="pl-8 pt-1 text-[11px] text-neutral-400 space-y-1.5 border-t border-neutral-800/60">
                              <span className="font-semibold text-indigo-400">
                                ↳ กิ่งเงื่อนไขตัดสินใจ (Decision Branches):
                              </span>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-emerald-400 font-mono">Yes:</span>
                                  <input
                                    type="text"
                                    value={node.branches?.[1]?.label || "ถูกต้อง (Yes)"}
                                    onChange={(e) => {
                                      const updated = [...flowNodes];
                                      if (!updated[idx].branches) updated[idx].branches = [];
                                      if (!updated[idx].branches![1]) {
                                        updated[idx].branches![1] = { targetId: "End", label: e.target.value };
                                      } else {
                                        updated[idx].branches![1].label = e.target.value;
                                      }
                                      setFlowNodes(updated);
                                    }}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-neutral-200 w-full"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-rose-400 font-mono">No:</span>
                                  <input
                                    type="text"
                                    value={node.branches?.[0]?.label || "ไม่ถูกต้อง (No)"}
                                    onChange={(e) => {
                                      const updated = [...flowNodes];
                                      if (!updated[idx].branches) updated[idx].branches = [];
                                      if (!updated[idx].branches![0]) {
                                        updated[idx].branches![0] = { targetId: "Alert", label: e.target.value };
                                      } else {
                                        updated[idx].branches![0].label = e.target.value;
                                      }
                                      setFlowNodes(updated);
                                    }}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-neutral-200 w-full"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORM CONTROLS: SEQUENCE DIAGRAM */}
                {visualType === "sequence" && (
                  <div className="space-y-4">
                    {/* Participants */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          {lang === "th" ? "ผู้มีส่วนร่วม (Participants/Actors)" : "Participants"}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const next = seqParticipants.length + 1;
                            setSeqParticipants([...seqParticipants, { id: `Actor${next}`, label: `Actor ${next}` }]);
                          }}
                          className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === "th" ? "เพิ่มผู้มีส่วนร่วม" : "Add Actor"}</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {seqParticipants.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-lg p-1.5">
                            <input
                              type="text"
                              value={p.label}
                              onChange={(e) => {
                                const updated = [...seqParticipants];
                                updated[idx].label = e.target.value;
                                setSeqParticipants(updated);
                              }}
                              className="bg-transparent text-xs text-neutral-200 w-28 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setSeqParticipants(seqParticipants.filter((_, i) => i !== idx))}
                              disabled={seqParticipants.length <= 2}
                              className="text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Messages */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          {lang === "th" ? "ข้อความและการเรียก (Messages)" : "Messages"}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSeqMessages([
                              ...seqMessages,
                              {
                                from: seqParticipants[0]?.id || "User",
                                to: seqParticipants[1]?.id || "API",
                                text: "New Request",
                                type: "solid",
                              },
                            ]);
                          }}
                          className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === "th" ? "เพิ่มข้อความ" : "Add Message"}</span>
                        </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {seqMessages.map((msg, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-xl">
                            <select
                              value={msg.from}
                              onChange={(e) => {
                                const updated = [...seqMessages];
                                updated[idx].from = e.target.value;
                                setSeqMessages(updated);
                              }}
                              className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
                            >
                              {seqParticipants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>

                            <select
                              value={msg.type}
                              onChange={(e) => {
                                const updated = [...seqMessages];
                                updated[idx].type = e.target.value as SequenceMessage["type"];
                                setSeqMessages(updated);
                              }}
                              className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
                            >
                              <option value="solid">→ (Request)</option>
                              <option value="dotted">⇢ (Response)</option>
                              <option value="fail">⤬ (Error)</option>
                            </select>

                            <select
                              value={msg.to}
                              onChange={(e) => {
                                const updated = [...seqMessages];
                                updated[idx].to = e.target.value;
                                setSeqMessages(updated);
                              }}
                              className="bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
                            >
                              {seqParticipants.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              value={msg.text}
                              onChange={(e) => {
                                const updated = [...seqMessages];
                                updated[idx].text = e.target.value;
                                setSeqMessages(updated);
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200"
                              placeholder="Message label..."
                            />

                            <button
                              type="button"
                              onClick={() => setSeqMessages(seqMessages.filter((_, i) => i !== idx))}
                              disabled={seqMessages.length <= 1}
                              className="text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* FORM CONTROLS: BAR & LINE */}
                {visualType === "bar" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          {lang === "th" ? "ชนิดกราฟ" : "Mode"}:
                        </label>
                        <button
                          type="button"
                          onClick={() => setChartMode("bar")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            chartMode === "bar" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          แท่ง (Bar)
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode("line")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            chartMode === "line" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          เส้น (Line)
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode("both")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            chartMode === "both" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          ทั้งคู่ (Both)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = chartItems.length + 1;
                          setChartItems([
                            ...chartItems,
                            { label: `รายการ ${nextIdx}`, value: 50, lineValue: 45 },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มแถว" : "Add Row"}</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {chartItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const updated = [...chartItems];
                              updated[idx].label = e.target.value;
                              setChartItems(updated);
                            }}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200"
                            placeholder="Label"
                          />
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) => {
                              const updated = [...chartItems];
                              updated[idx].value = Number(e.target.value) || 0;
                              setChartItems(updated);
                            }}
                            className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                            placeholder="Value"
                          />
                          {chartMode === "both" && (
                            <input
                              type="number"
                              value={item.lineValue}
                              onChange={(e) => {
                                const updated = [...chartItems];
                                updated[idx].lineValue = Number(e.target.value) || 0;
                                setChartItems(updated);
                              }}
                              className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-sky-400"
                              placeholder="Line Target"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setChartItems(chartItems.filter((_, i) => i !== idx))}
                            disabled={chartItems.length <= 2}
                            className="p-1 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORM CONTROLS: PIE */}
                {visualType === "pie" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {lang === "th" ? "รายการและสัดส่วน" : "Slices"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = pieItems.length + 1;
                          setPieItems([...pieItems, { label: `หมวดหมู่ ${nextIdx}`, value: 20 }]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มหมวดหมู่" : "Add Slice"}</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {pieItems.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const updated = [...pieItems];
                              updated[idx].label = e.target.value;
                              setPieItems(updated);
                            }}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200"
                          />
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) => {
                              const updated = [...pieItems];
                              updated[idx].value = Number(e.target.value) || 0;
                              setPieItems(updated);
                            }}
                            className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
                          />
                          <button
                            type="button"
                            onClick={() => setPieItems(pieItems.filter((_, i) => i !== idx))}
                            disabled={pieItems.length <= 2}
                            className="p-1 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORM CONTROLS: MINDMAP */}
                {visualType === "mindmap" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                        {lang === "th" ? "แกนกลางความคิด (Root)" : "Central Topic"}
                      </label>
                      <input
                        type="text"
                        value={mindmapRoot}
                        onChange={(e) => setMindmapRoot(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-200"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {lang === "th" ? "กิ่งความคิดหลักและย่อย" : "Branches"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMindmapBranches([
                            ...mindmapBranches,
                            { label: "ประเด็นหลักใหม่", subBranches: ["ประเด็นย่อย"] },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มกิ่งหลัก" : "Add Branch"}</span>
                      </button>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {mindmapBranches.map((b, idx) => (
                        <div key={idx} className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-indigo-400 font-bold">●</span>
                            <input
                              type="text"
                              value={b.label}
                              onChange={(e) => {
                                const updated = [...mindmapBranches];
                                updated[idx].label = e.target.value;
                                setMindmapBranches(updated);
                              }}
                              className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1 text-xs text-neutral-200"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...mindmapBranches];
                                if (!updated[idx].subBranches) updated[idx].subBranches = [];
                                updated[idx].subBranches!.push("กิ่งย่อยใหม่");
                                setMindmapBranches(updated);
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-500/10 cursor-pointer"
                            >
                              + กิ่งย่อย
                            </button>
                            <button
                              type="button"
                              onClick={() => setMindmapBranches(mindmapBranches.filter((_, i) => i !== idx))}
                              disabled={mindmapBranches.length <= 1}
                              className="text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {b.subBranches && b.subBranches.length > 0 && (
                            <div className="pl-6 space-y-1.5">
                              {b.subBranches.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center gap-1.5">
                                  <span className="text-neutral-600 text-[11px]">↳</span>
                                  <input
                                    type="text"
                                    value={sub}
                                    onChange={(e) => {
                                      const updated = [...mindmapBranches];
                                      updated[idx].subBranches![sIdx] = e.target.value;
                                      setMindmapBranches(updated);
                                    }}
                                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-neutral-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...mindmapBranches];
                                      updated[idx].subBranches = updated[idx].subBranches!.filter((_, i) => i !== sIdx);
                                      setMindmapBranches(updated);
                                    }}
                                    className="text-neutral-500 hover:text-rose-400 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORM CONTROLS: STATE MACHINE */}
                {visualType === "state" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {lang === "th" ? "การเปลี่ยนผ่านสถานะ (State Transitions)" : "Transitions"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setStateTransitions([
                            ...stateTransitions,
                            { from: "StateA", to: "StateB", label: "Event" },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มสถานะ" : "Add Transition"}</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {stateTransitions.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-xl">
                          <input
                            type="text"
                            value={t.from}
                            onChange={(e) => {
                              const updated = [...stateTransitions];
                              updated[idx].from = e.target.value;
                              setStateTransitions(updated);
                            }}
                            className="w-24 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200"
                            placeholder="From"
                          />
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <input
                            type="text"
                            value={t.to}
                            onChange={(e) => {
                              const updated = [...stateTransitions];
                              updated[idx].to = e.target.value;
                              setStateTransitions(updated);
                            }}
                            className="w-24 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200"
                            placeholder="To"
                          />
                          <input
                            type="text"
                            value={t.label}
                            onChange={(e) => {
                              const updated = [...stateTransitions];
                              updated[idx].label = e.target.value;
                              setStateTransitions(updated);
                            }}
                            className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200"
                            placeholder="Label (Action)"
                          />
                          <button
                            type="button"
                            onClick={() => setStateTransitions(stateTransitions.filter((_, i) => i !== idx))}
                            disabled={stateTransitions.length <= 1}
                            className="text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 2. TEMPLATES GALLERY TAB */}
            {activeTab === "templates" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                    {lang === "th" ? "คลังแม่แบบสำเร็จรูประดับมืออาชีพ" : "Curated Professional Templates"}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {lang === "th"
                      ? "คลิกเลือกแม่แบบเพื่อดูพรีวิวสด และนำไปใช้หรือแก้ไขต่อได้ทันที"
                      : "Pick any template to inspect live and customize in the editor."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {DIAGRAM_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className="group p-4 rounded-2xl border border-neutral-800 bg-neutral-950/60 hover:bg-neutral-900/90 hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                            {tmpl.badge}
                          </span>
                          <span className="text-[11px] font-semibold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                            เลือกแม่แบบ →
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-neutral-200 mb-1 group-hover:text-indigo-300 transition-colors">
                          {tmpl.name[lang]}
                        </h4>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {tmpl.description[lang]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. DIRECT MERMAID CODE TAB */}
            {activeTab === "code" && (
              <div className="space-y-4 flex-1 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    <Code className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === "th" ? "แก้ไขโค้ด Mermaid ดิบ" : "Raw Mermaid Editor"}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomCode(generatedVisualCode)}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200 cursor-pointer"
                    title="โหลดโค้ดจากแบบฟอร์มภาพ"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{lang === "th" ? "ดึงค่าจาก Visual" : "Reset from Visual"}</span>
                  </button>
                </div>

                <div className="flex-1 flex flex-col relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
                  <textarea
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="w-full flex-1 p-4 font-mono text-xs text-neutral-200 bg-transparent focus:outline-none resize-none leading-relaxed"
                    placeholder="Enter Mermaid diagram syntax..."
                    spellCheck={false}
                  />
                  <div className="px-4 py-2 bg-neutral-900/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span>Mermaid v12.0 • Real-time Validation</span>
                    <span>{customCode.split("\n").length} Lines</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Vector Preview */}
          <div className="lg:col-span-6 flex flex-col bg-neutral-950 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Eye className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-neutral-200">
                  {lang === "th" ? "พรีวิวสดเวกเตอร์ (Pure Vector Preview)" : "Live Vector Preview"}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Interactive Canvas
              </span>
            </div>

            {/* Live Chart Canvas */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <MermaidChart chart={activeMermaidCode} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleInsert}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{lang === "th" ? "แทรกลงในโน้ต (Insert into Note)" : "Insert into Note"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
