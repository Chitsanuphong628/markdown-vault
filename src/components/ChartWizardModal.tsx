"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import MermaidChart from "@/components/MermaidChart";
import { Language } from "@/lib/i18n";

interface ChartWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertChart: (markdown: string) => void;
  lang: Language;
}

type ChartType = "bar" | "pie" | "flowchart" | "mindmap";

interface DataItem {
  id: string;
  label: string;
  value: number | string;
}

const COLOR_PALETTES = [
  { key: "emerald", name: { en: "Emerald Mint", th: "เขียวมินต์" }, primary: "#10b981", bg: "bg-emerald-500" },
  { key: "sky", name: { en: "Ocean Sky", th: "ฟ้าน้ำทะเล" }, primary: "#0ea5e9", bg: "bg-sky-500" },
  { key: "amber", name: { en: "Warm Amber", th: "ส้มอำพัน" }, primary: "#f59e0b", bg: "bg-amber-500" },
  { key: "purple", name: { en: "Neon Purple", th: "ม่วงนีออน" }, primary: "#a855f7", bg: "bg-purple-500" },
  { key: "rose", name: { en: "Berry Rose", th: "ชมพูเบอร์รี่" }, primary: "#f43f5e", bg: "bg-rose-500" },
  { key: "slate", name: { en: "Clean Slate", th: "เทาคลาสสิก" }, primary: "#94a3b8", bg: "bg-slate-400" },
];

export default function ChartWizardModal({
  isOpen,
  onClose,
  onInsertChart,
  lang,
}: ChartWizardModalProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [title, setTitle] = useState(lang === "th" ? "สถิติและข้อมูลสรุป" : "Summary Statistics");
  const [activePalette, setActivePalette] = useState(COLOR_PALETTES[0].key);

  // Bar / Pie Data
  const [items, setItems] = useState<DataItem[]>([
    { id: "1", label: lang === "th" ? "ไตรมาส 1" : "Quarter 1", value: 35 },
    { id: "2", label: lang === "th" ? "ไตรมาส 2" : "Quarter 2", value: 65 },
    { id: "3", label: lang === "th" ? "ไตรมาส 3" : "Quarter 3", value: 85 },
    { id: "4", label: lang === "th" ? "ไตรมาส 4" : "Quarter 4", value: 50 },
  ]);

  // Flowchart Steps
  const [steps, setSteps] = useState<string[]>([
    lang === "th" ? "1. เริ่มต้นโครงการ" : "1. Start Project",
    lang === "th" ? "2. ออกแบบและพัฒนา" : "2. Design & Build",
    lang === "th" ? "3. ทดสอบระบบ" : "3. Quality Testing",
    lang === "th" ? "4. ปล่อยใช้งานจริง" : "4. Production Launch",
  ]);

  // Mindmap Nodes
  const [mindmapRoot, setMindmapRoot] = useState(lang === "th" ? "แผนงานหลัก" : "Core Vision");
  const [mindmapBranches, setMindmapBranches] = useState<string[]>([
    lang === "th" ? "ฟีเจอร์หลัก" : "Features",
    lang === "th" ? "การออกแบบ UI/UX" : "UI/UX Design",
    lang === "th" ? "การตลาดและการเปิดตัว" : "Marketing",
  ]);

  // Generate Mermaid Syntax
  const generatedMermaid = useMemo(() => {
    const cleanTitle = title.replace(/[^\w\u0E00-\u0E7F\s-]/g, "").trim() || "Chart";
    const palette = COLOR_PALETTES.find((item) => item.key === activePalette) || COLOR_PALETTES[0];
    const themeDirective = `%%{init: ${JSON.stringify({
      themeVariables: {
        primaryColor: palette.primary,
        primaryBorderColor: palette.primary,
        lineColor: palette.primary,
        secondaryColor: palette.primary,
        pie1: palette.primary,
      },
    })}}%%`;
    const withPalette = (chart: string) => `${themeDirective}\n${chart}`;

    if (chartType === "bar") {
      const labels = items.map((i) => `"${i.label.replace(/"/g, "")}"`).join(", ");
      const values = items.map((i) => (Number(i.value) || 0)).join(", ");
      return withPalette(`xychart-beta
    title "${cleanTitle}"
    x-axis [${labels}]
    y-axis "Value" 0 --> 100
    bar [${values}]`);
    }

    if (chartType === "pie") {
      const slices = items
        .map((i) => `    "${i.label.replace(/"/g, "")}" : ${Number(i.value) || 1}`)
        .join("\n");
      return withPalette(`pie title ${cleanTitle}\n${slices}`);
    }

    if (chartType === "flowchart") {
      let flow = "flowchart LR\n";
      steps.forEach((step, idx) => {
        const nodeId = `S${idx + 1}`;
        const cleanStep = step.replace(/[\[\]"()]/g, "").trim();
        flow += `    ${nodeId}["${cleanStep}"]\n`;
        if (idx < steps.length - 1) {
          flow += `    ${nodeId} --> S${idx + 2}\n`;
        }
      });
      return withPalette(flow);
    }

    if (chartType === "mindmap") {
      let mm = `mindmap\n  root(("${mindmapRoot.replace(/[()]/g, "")}"))\n`;
      mindmapBranches.forEach((branch) => {
        mm += `    ["${branch.replace(/[\[\]]/g, "")}"]\n`;
      });
      return withPalette(mm);
    }

    return "";
  }, [activePalette, chartType, title, items, steps, mindmapRoot, mindmapBranches]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const nextIdx = items.length + 1;
    setItems([
      ...items,
      {
        id: String(Date.now()),
        label: `${lang === "th" ? "หัวข้อ" : "Item"} ${nextIdx}`,
        value: 30,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 2) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleInsert = () => {
    const markdown = `\n\`\`\`mermaid\n${generatedMermaid}\n\`\`\`\n`;
    onInsertChart(markdown);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                {lang === "th" ? "สร้างชาร์ตและผังงาน (Chart Wizard)" : "Visual Chart Wizard"}
              </h2>
              <p className="text-xs text-neutral-400">
                {lang === "th"
                  ? "เลือกประเภท ป้อนข้อมูล และเลือกโทนสี แทรกลงโน้ตได้ทันที"
                  : "Pick a chart type, enter data, and insert directly into your note"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Configuration Controls */}
          <div className="space-y-5">
            {/* Chart Type Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                {lang === "th" ? "ประเภทของชาร์ต" : "Chart Type"}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChartType("bar")}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    chartType === "bar"
                      ? "bg-indigo-600/15 border-indigo-500 text-indigo-300"
                      : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <span>{lang === "th" ? "กราฟแท่ง (Bar)" : "Bar Chart"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChartType("pie")}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    chartType === "pie"
                      ? "bg-indigo-600/15 border-indigo-500 text-indigo-300"
                      : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <PieChart className="w-4 h-4 text-sky-400" />
                  <span>{lang === "th" ? "กราฟวงกลม (Pie)" : "Pie Chart"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChartType("flowchart")}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    chartType === "flowchart"
                      ? "bg-indigo-600/15 border-indigo-500 text-indigo-300"
                      : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <GitFork className="w-4 h-4 text-emerald-400" />
                  <span>{lang === "th" ? "ผังลำดับงาน (Flow)" : "Flowchart"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChartType("mindmap")}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    chartType === "mindmap"
                      ? "bg-indigo-600/15 border-indigo-500 text-indigo-300"
                      : "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  <Network className="w-4 h-4 text-amber-400" />
                  <span>{lang === "th" ? "แผนผังความคิด (Mindmap)" : "Mindmap"}</span>
                </button>
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                {lang === "th" ? "หัวข้อชาร์ต" : "Chart Title"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-neutral-200 focus:outline-none focus:border-indigo-500"
                placeholder={lang === "th" ? "ใส่ชื่อกราฟ..." : "Enter chart title..."}
              />
            </div>

            {/* Palette Selector */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                <Palette className="w-3.5 h-3.5" />
                {lang === "th" ? "โทนสี" : "Color Palette"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COLOR_PALETTES.map((palette) => (
                  <button
                    key={palette.key}
                    type="button"
                    aria-pressed={activePalette === palette.key}
                    onClick={() => setActivePalette(palette.key)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors cursor-pointer ${
                      activePalette === palette.key
                        ? "border-indigo-400 bg-indigo-500/10 text-neutral-100"
                        : "border-neutral-800 bg-neutral-950/50 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full shrink-0 ${palette.bg}`} />
                    <span className="truncate">{palette.name[lang]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Data editor depending on chart type */}
            {(chartType === "bar" || chartType === "pie") && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {lang === "th" ? "รายการข้อมูลและตัวเลข" : "Data Items & Values"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === "th" ? "เพิ่มแถว" : "Add Row"}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].label = e.target.value;
                          setItems(updated);
                        }}
                        placeholder="Label"
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="number"
                        value={item.value}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].value = Number(e.target.value) || 0;
                          setItems(updated);
                        }}
                        placeholder="Value"
                        className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 2}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chartType === "flowchart" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    {lang === "th" ? "ขั้นตอนของกระบวนการ" : "Process Steps"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSteps([...steps, `${steps.length + 1}. ขั้นตอนใหม่`])}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === "th" ? "เพิ่มขั้นตอน" : "Add Step"}</span>
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 w-5 text-right font-mono">{idx + 1}.</span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => {
                          const updated = [...steps];
                          updated[idx] = e.target.value;
                          setSteps(updated);
                        }}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                        disabled={steps.length <= 2}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chartType === "mindmap" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                    {lang === "th" ? "หัวข้อแกนกลาง (Root)" : "Central Topic"}
                  </label>
                  <input
                    type="text"
                    value={mindmapRoot}
                    onChange={(e) => setMindmapRoot(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      {lang === "th" ? "กิ่งย่อย (Branches)" : "Branches"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setMindmapBranches([...mindmapBranches, "ประเด็นย่อยใหม่"])}
                      className="flex items-center gap-1 text-xs text-indigo-400 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === "th" ? "เพิ่มกิ่ง" : "Add Branch"}</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {mindmapBranches.map((branch, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={branch}
                          onChange={(e) => {
                            const updated = [...mindmapBranches];
                            updated[idx] = e.target.value;
                            setMindmapBranches(updated);
                          }}
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200"
                        />
                        <button
                          type="button"
                          onClick={() => setMindmapBranches(mindmapBranches.filter((_, i) => i !== idx))}
                          disabled={mindmapBranches.length <= 1}
                          className="p-1.5 text-neutral-500 hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Chart Preview */}
          <div className="flex flex-col bg-neutral-950 border border-neutral-800/80 rounded-xl p-4 min-h-[300px]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>{lang === "th" ? "พรีวิวสด (Live Preview)" : "Live Preview"}</span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500 uppercase">{chartType}</span>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <MermaidChart chart={generatedMermaid} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            {lang === "th" ? "ยกเลิก" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={handleInsert}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{lang === "th" ? "แทรกลงในโน้ต" : "Insert into Note"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
