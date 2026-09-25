"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  Code,
  ArrowRight,
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

const VISUAL_TYPES: Array<{ id: VisualType; en: string; th: string; titleEn: string; titleTh: string }> = [
  { id: "flowchart", en: "Flowchart", th: "ผังงาน", titleEn: "Process flow", titleTh: "ผังกระบวนการ" },
  { id: "sequence", en: "Sequence", th: "ลำดับงาน", titleEn: "Sequence diagram", titleTh: "ลำดับการทำงาน" },
  { id: "bar", en: "Bar / line", th: "กราฟแท่ง / เส้น", titleEn: "Metrics", titleTh: "สถิติ" },
  { id: "pie", en: "Pie", th: "กราฟวงกลม", titleEn: "Distribution", titleTh: "สัดส่วน" },
  { id: "mindmap", en: "Mind map", th: "ผังความคิด", titleEn: "Mind map", titleTh: "ผังความคิด" },
  { id: "state", en: "State", th: "สถานะ", titleEn: "State diagram", titleTh: "สถานะการทำงาน" },
];

export default function ChartWizardModal({
  isOpen,
  onClose,
  onInsertChart,
  lang,
}: ChartWizardModalProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>("visual");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visualType, setVisualType] = useState<VisualType>("flowchart");
  const [mobilePanel, setMobilePanel] = useState<"edit" | "preview">("edit");
  const [activePalette, setActivePalette] = useState(COLOR_PALETTES[0].key);
  const [previewResult, setPreviewResult] = useState<{ code: string; valid: boolean }>({ code: "", valid: false });

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
  const [mindmapRoot, setMindmapRoot] = useState(lang === "th" ? "โครงการ" : "Project");
  const [mindmapBranches, setMindmapBranches] = useState([
    {
      label: lang === "th" ? "เป้าหมาย" : "Goals",
      subBranches: [lang === "th" ? "ผลลัพธ์" : "Outcome", lang === "th" ? "ตัวชี้วัด" : "Measure"],
    },
    {
      label: lang === "th" ? "งาน" : "Tasks",
      subBranches: [lang === "th" ? "วางแผน" : "Plan", lang === "th" ? "ตรวจทาน" : "Review"],
    },
    {
      label: lang === "th" ? "คำถาม" : "Questions",
      subBranches: [lang === "th" ? "ประเด็นค้าง" : "Open items"],
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

  // Active Mermaid Code depending on tab
  const activeMermaidCode = useMemo(() => {
    if (activeTab === "code") {
      return customCode;
    }
    return attachThemeDirective(generatedVisualCode, activePalette);
  }, [activeTab, customCode, generatedVisualCode, activePalette]);
  const handleValidationChange = useCallback((code: string, valid: boolean) => {
    setPreviewResult({ code, valid });
  }, []);
  const hasCode = Boolean(activeMermaidCode.trim());
  const previewState = !hasCode ? "empty" : previewResult.code !== activeMermaidCode ? "rendering" : previewResult.valid ? "ready" : "invalid";
  const canInsert = previewState === "ready";

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[data-mermaid-fullscreen="true"]')) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: DiagramTemplate) => {
    setCustomCode(template.mermaidCode);
    setActiveTab("code");
    setMobilePanel("preview");
  };

  const handleInsert = () => {
    if (!canInsert) return;
    const markdown = `\n\`\`\`mermaid\n${activeMermaidCode.trim()}\n\`\`\`\n`;
    onInsertChart(markdown);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 sm:p-5">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-studio-title"
        className="bg-[#0f1117] border border-[#222634] sm:rounded-lg w-full max-w-6xl h-dvh sm:h-[min(92vh,900px)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#222634] px-4 py-3 sm:px-5">
          <h2 id="chart-studio-title" className="text-sm font-semibold text-neutral-100">
            {lang === "th" ? "สร้างกราฟและแผนภาพ" : "Chart & Diagram Studio"}
          </h2>
          <button type="button" onClick={onClose} aria-label={lang === "th" ? "ปิดสตูดิโอ" : "Close studio"} className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#222634] px-4 sm:px-5">
          <div role="tablist" aria-label={lang === "th" ? "วิธีสร้าง" : "Creation method"} className="flex gap-5 overflow-x-auto">
            {([
              ["visual", lang === "th" ? "สร้างเอง" : "Build"],
              ["templates", lang === "th" ? "แม่แบบ" : "Templates"],
              ["code", "Mermaid"],
            ] as const).map(([tab, label]) => (
              <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
                onClick={() => {
                  if (tab === "code" && !customCode) setCustomCode(generatedVisualCode);
                  setActiveTab(tab);
                  setMobilePanel("edit");
                }}
                className={`shrink-0 border-b-2 py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  activeTab === tab ? "border-indigo-500 text-white" : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div role="group" aria-label={lang === "th" ? "มุมมองมือถือ" : "Mobile view"} className="flex shrink-0 gap-1 lg:hidden">
            <button type="button" aria-pressed={mobilePanel === "edit"} onClick={() => setMobilePanel("edit")} className={`rounded px-2 py-1 text-xs ${mobilePanel === "edit" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}>{lang === "th" ? "แก้ไข" : "Edit"}</button>
            <button type="button" aria-pressed={mobilePanel === "preview"} onClick={() => setMobilePanel("preview")} className={`rounded px-2 py-1 text-xs ${mobilePanel === "preview" ? "bg-neutral-700 text-white" : "text-neutral-400"}`}>{lang === "th" ? "พรีวิว" : "Preview"}</button>
          </div>
        </div>

        {/* Studio Body: Split View (Controls Left, Live Vector Preview Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Form / Template / Code Panel */}
          <div className={`${mobilePanel === "preview" ? "hidden lg:flex" : "flex"} lg:col-span-6 min-h-0 flex-col lg:border-r border-[#222634] overflow-y-auto p-4 sm:p-5 space-y-5`}>
            {/* 1. VISUAL BUILDER TAB */}
            {activeTab === "visual" && (
              <>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    {lang === "th" ? "ประเภทแผนภาพ" : "Diagram type"}
                  </label>
                  <div role="group" aria-label={lang === "th" ? "ประเภทแผนภาพ" : "Diagram type"} className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {VISUAL_TYPES.map((type) => (
                      <button key={type.id} type="button" aria-pressed={visualType === type.id}
                        onClick={() => {
                          setVisualType(type.id);
                          setTitle(lang === "th" ? type.titleTh : type.titleEn);
                        }}
                        className={`rounded border px-3 py-2 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                          visualType === type.id
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                            : "border-[#222634] text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/50"
                        }`}>
                        {lang === "th" ? type.th : type.en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`grid gap-4 ${visualType === "bar" || visualType === "pie" ? "sm:grid-cols-2" : ""}`}>
                  {(visualType === "bar" || visualType === "pie") && <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                      {lang === "th" ? "ชื่อกราฟ" : "Chart title"}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      placeholder={lang === "th" ? "ชื่อกราฟ" : "Chart title"}
                    />
                  </div>}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                      {lang === "th" ? "โทนสี" : "Color palette"}
                    </label>
                    <select
                      value={activePalette}
                      onChange={(e) => setActivePalette(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
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
                          {lang === "th" ? "บนลงล่าง" : "Top to bottom"}
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
                          {lang === "th" ? "ซ้ายไปขวา" : "Left to right"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          let nextIdx = flowNodes.length + 1;
                          while (flowNodes.some(node => node.id === `Step${nextIdx}`)) nextIdx++;
                          setFlowNodes([
                            ...flowNodes,
                            { id: `Step${nextIdx}`, label: lang === "th" ? `ขั้นตอน ${nextIdx}` : `Step ${nextIdx}`, shape: "rect" },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มโหนด" : "Add Step"}</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 ">
                      {flowNodes.map((node, idx) => (
                        <div
                          key={node.id}
                          className="border-b border-[#222634] py-3 space-y-2"
                        >
                          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-2 sm:flex">
                            <span className="text-xs font-mono text-neutral-500 w-6">{idx + 1}.</span>
                            <select
                              value={node.shape}
                              onChange={(e) => {
                                const shape = e.target.value as FlowNode["shape"];
                                const otherNodes = [...flowNodes.slice(idx + 1), ...flowNodes.slice(0, idx)];
                                setFlowNodes(flowNodes.map((item, itemIndex) => itemIndex === idx ? {
                                  ...item,
                                  shape,
                                  branches: shape === "diamond" ? item.branches || [
                                    { targetId: otherNodes[0]?.id || item.id, label: lang === "th" ? "ไม่" : "No" },
                                    { targetId: otherNodes[1]?.id || otherNodes[0]?.id || item.id, label: lang === "th" ? "ใช่" : "Yes" },
                                  ] : undefined,
                                } : item));
                              }}
                              className="min-w-0 w-full sm:w-auto bg-neutral-900 border border-neutral-700/80 rounded-md px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                            >
                              <option value="rect">{lang === "th" ? "ขั้นตอน" : "Process"}</option>
                              <option value="diamond">{lang === "th" ? "เงื่อนไข" : "Decision"}</option>
                              <option value="round">{lang === "th" ? "เริ่ม / จบ" : "Start / end"}</option>
                              <option value="database">{lang === "th" ? "ฐานข้อมูล" : "Database"}</option>
                            </select>

                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const updated = [...flowNodes];
                                updated[idx].label = e.target.value;
                                setFlowNodes(updated);
                              }}
                              className="col-start-2 col-span-2 row-start-2 min-w-0 w-full sm:col-auto sm:row-auto sm:flex-1 bg-neutral-900 border border-neutral-700/80 rounded-md px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                              placeholder={lang === "th" ? "ข้อความในขั้นตอน" : "Step label"}
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const remaining = flowNodes.filter((_, itemIndex) => itemIndex !== idx);
                                setFlowNodes(remaining.map(item => ({
                                  ...item,
                                  branches: item.branches?.map(branch => branch.targetId === node.id
                                    ? { ...branch, targetId: remaining.find(target => target.id !== item.id)?.id || item.id }
                                    : branch),
                                })));
                              }}
                              disabled={flowNodes.length <= 2}
                              className="col-start-3 row-start-1 sm:col-auto sm:row-auto p-1 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {node.shape === "diamond" && node.branches && (
                            <div className="space-y-2 border-t border-[#222634] pt-3 sm:pl-8">
                              <span className="text-[11px] font-medium text-neutral-400">
                                {lang === "th" ? "ทางแยก" : "Branches"}
                              </span>
                              {node.branches.map((branch, branchIndex) => (
                                <div key={`${node.id}-${branchIndex}`} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                                  <span className="font-mono text-[11px] text-neutral-400">
                                    {branchIndex === 0 ? (lang === "th" ? "ไม่" : "No") : (lang === "th" ? "ใช่" : "Yes")}
                                  </span>
                                  <input type="text" value={branch.label || ""}
                                    aria-label={lang === "th" ? "ข้อความทางแยก" : "Branch label"}
                                    onChange={event => setFlowNodes(flowNodes.map((item, itemIndex) => itemIndex === idx ? {
                                      ...item,
                                      branches: item.branches?.map((entry, entryIndex) => entryIndex === branchIndex ? { ...entry, label: event.target.value } : entry),
                                    } : item))}
                                    className="min-w-0 rounded border border-[#222634] bg-[#161922] px-2 py-1 text-xs text-neutral-200" />
                                  <span className="text-[10px] text-neutral-500">→</span>
                                  <select value={branch.targetId} aria-label={lang === "th" ? "ปลายทางทางแยก" : "Branch target"}
                                    onChange={event => setFlowNodes(flowNodes.map((item, itemIndex) => itemIndex === idx ? {
                                      ...item,
                                      branches: item.branches?.map((entry, entryIndex) => entryIndex === branchIndex ? { ...entry, targetId: event.target.value } : entry),
                                    } : item))}
                                    className="min-w-0 rounded border border-[#222634] bg-[#161922] px-2 py-1 text-xs text-neutral-200">
                                    {flowNodes.filter(target => target.id !== node.id).map(target => (
                                      <option key={target.id} value={target.id}>{target.label || target.id}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
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

                      <div className="space-y-2 ">
                        {seqMessages.map((msg, idx) => (
                          <div key={idx} className="grid grid-cols-3 items-center gap-2 border-b border-[#222634] py-2 sm:flex">
                            <select
                              value={msg.from}
                              onChange={(e) => {
                                const updated = [...seqMessages];
                                updated[idx].from = e.target.value;
                                setSeqMessages(updated);
                              }}
                              className="min-w-0 w-full bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
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
                              className="min-w-0 w-full bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
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
                              className="min-w-0 w-full bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-xs text-neutral-300"
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
                              className="col-span-2 min-w-0 w-full sm:flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200"
                              placeholder="Message label..."
                            />

                            <button
                              type="button"
                              onClick={() => setSeqMessages(seqMessages.filter((_, i) => i !== idx))}
                              disabled={seqMessages.length <= 1}
                              className="justify-self-end text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
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
                      <div className="flex flex-wrap items-center gap-2">
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
                          {lang === "th" ? "แท่ง" : "Bar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode("line")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            chartMode === "line" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          {lang === "th" ? "เส้น" : "Line"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode("both")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            chartMode === "both" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"
                          }`}
                        >
                          {lang === "th" ? "ทั้งคู่" : "Both"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = chartItems.length + 1;
                          setChartItems([
                            ...chartItems,
                            { label: lang === "th" ? `รายการ ${nextIdx}` : `Item ${nextIdx}`, value: 50, lineValue: 45 },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มแถว" : "Add Row"}</span>
                      </button>
                    </div>

                    <div className="space-y-2 ">
                      {chartItems.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 border-b border-[#222634] py-2 sm:border-0 sm:py-0">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const updated = [...chartItems];
                              updated[idx].label = e.target.value;
                              setChartItems(updated);
                            }}
                            className="min-w-0 basis-full sm:basis-auto sm:flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-200"
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
                          setPieItems([...pieItems, { label: lang === "th" ? `หมวดหมู่ ${nextIdx}` : `Category ${nextIdx}`, value: 20 }]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มหมวดหมู่" : "Add Slice"}</span>
                      </button>
                    </div>

                    <div className="space-y-2 ">
                      {pieItems.map((item, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 border-b border-[#222634] py-2 sm:border-0 sm:py-0">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const updated = [...pieItems];
                              updated[idx].label = e.target.value;
                              setPieItems(updated);
                            }}
                            className="min-w-0 basis-full sm:basis-auto sm:flex-1 bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-200"
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
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-200"
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
                            { label: lang === "th" ? "ประเด็นใหม่" : "New branch", subBranches: [lang === "th" ? "ประเด็นย่อย" : "Subtopic"] },
                          ]);
                        }}
                        className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === "th" ? "เพิ่มกิ่งหลัก" : "Add Branch"}</span>
                      </button>
                    </div>

                    <div className="space-y-3 ">
                      {mindmapBranches.map((b, idx) => (
                        <div key={idx} className="border-b border-[#222634] py-3 space-y-2">
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
                                updated[idx].subBranches!.push(lang === "th" ? "ประเด็นย่อย" : "Subtopic");
                                setMindmapBranches(updated);
                              }}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-500/10 cursor-pointer"
                            >
                              {lang === "th" ? "+ ประเด็นย่อย" : "+ Subtopic"}
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

                    <div className="space-y-2 ">
                      {stateTransitions.map((t, idx) => (
                        <div key={idx} className="grid grid-cols-[6rem_auto_6rem_1.25rem] items-center gap-2 border-b border-[#222634] py-2 sm:flex">
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
                            className="col-span-4 row-start-2 min-w-0 w-full sm:col-auto sm:row-auto sm:flex-1 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200"
                            placeholder="Label (Action)"
                          />
                          <button
                            type="button"
                            onClick={() => setStateTransitions(stateTransitions.filter((_, i) => i !== idx))}
                            disabled={stateTransitions.length <= 1}
                            className="col-start-4 row-start-1 sm:col-auto sm:row-auto text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
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

            {/* Templates are selectable rows so the title and purpose remain scannable. */}
            {activeTab === "templates" && (
              <div className="space-y-1">
                <p className="mb-3 text-xs text-neutral-400">
                  {lang === "th" ? "เลือกแม่แบบเพื่อดูผล แล้วแก้ Mermaid ได้ต่อ" : "Choose a template to preview and edit its Mermaid source."}
                </p>
                {DIAGRAM_TEMPLATES.map((template) => (
                  <button key={template.id} type="button" onClick={() => handleSelectTemplate(template)}
                    className="group flex w-full items-start justify-between gap-3 border-b border-[#222634] px-2 py-3 text-left hover:bg-neutral-800/50 focus-visible:outline-2 focus-visible:outline-indigo-500">
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-neutral-100">{template.name[lang]}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-neutral-400">{template.description[lang]}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-neutral-500">{template.badge}</span>
                  </button>
                ))}
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

                <div className="flex-1 flex flex-col relative rounded-md overflow-hidden border border-[#222634] bg-[#161922]">
                  <textarea
                    aria-label={lang === "th" ? "โค้ด Mermaid" : "Mermaid source"}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="w-full flex-1 p-4 font-mono text-xs text-neutral-200 bg-transparent focus:outline-none resize-none leading-relaxed"
                    placeholder="Enter Mermaid diagram syntax..."
                    spellCheck={false}
                  />
                  <div className="px-4 py-2 border-t border-[#222634] text-right text-[11px] text-neutral-400 font-mono">
                    {customCode.split("\n").length} {lang === "th" ? "บรรทัด" : "lines"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`${mobilePanel === "edit" ? "hidden lg:flex" : "flex"} lg:col-span-6 min-h-0 flex-col bg-[#090a0f] p-4 sm:p-5 overflow-y-auto`}>
            <div className="flex items-center justify-between border-b border-[#222634] pb-3 text-xs">
              <span className="font-medium text-neutral-200">{lang === "th" ? "พรีวิว" : "Preview"}</span>
              <span role="status" className={previewState === "ready" ? "text-emerald-400" : previewState === "invalid" ? "text-rose-400" : "text-neutral-500"}>
                {previewState === "ready" ? (lang === "th" ? "พร้อมแทรก" : "Ready")
                  : previewState === "invalid" ? (lang === "th" ? "แก้โค้ดก่อนแทรก" : "Fix code before inserting")
                  : previewState === "empty" ? (lang === "th" ? "ใส่โค้ด Mermaid" : "Enter Mermaid code")
                  : (lang === "th" ? "กำลังแสดงผล" : "Rendering")}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {hasCode ? <MermaidChart chart={activeMermaidCode} studio onValidationChange={handleValidationChange} /> :
                <p className="px-2 py-12 text-center text-xs text-neutral-500">{lang === "th" ? "พิมพ์โค้ด Mermaid เพื่อดูแผนภาพ" : "Write Mermaid code to preview the diagram."}</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 border-t border-[#222634] bg-[#0f1117]">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleInsert}
              disabled={!canInsert}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              <Check className="w-4 h-4" />
              <span>{lang === "th" ? "แทรกในโน้ต" : "Insert into note"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
