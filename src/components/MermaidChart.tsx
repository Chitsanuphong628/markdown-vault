"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  ImageIcon,
  Code,
  AlertCircle,
} from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#16161e",
    primaryColor: "#6366f1",
    primaryTextColor: "#f4f4f5",
    primaryBorderColor: "#818cf8",
    lineColor: "#818cf8",
    secondaryColor: "#3b82f6",
    tertiaryColor: "#1e1e2e",
  },
  securityLevel: "strict",
});

interface MermaidChartProps {
  chart: string;
}

interface ChartToolbarProps {
  scale: number;
  copied: boolean;
  showSource: boolean;
  isFullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onCopy: () => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onToggleSource: () => void;
  onToggleFullscreen: () => void;
}

function ChartToolbar({
  scale,
  copied,
  showSource,
  isFullscreen,
  onZoomIn,
  onZoomOut,
  onReset,
  onCopy,
  onDownloadSvg,
  onDownloadPng,
  onToggleSource,
  onToggleFullscreen,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-1 bg-neutral-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-neutral-700/60 shadow-xl text-neutral-300 text-xs select-none">
      <button
        type="button"
        onClick={onZoomIn}
        title="ซูมเข้า (Zoom In)"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <span className="font-mono text-[11px] px-1.5 text-neutral-400 min-w-[3rem] text-center">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        onClick={onZoomOut}
        title="ซูมออก (Zoom Out)"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        title="รีเซ็ตตำแหน่งและขนาด (Reset View)"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-700 mx-1" />

      {/* Toggle View Source Code */}
      <button
        type="button"
        onClick={onToggleSource}
        title={showSource ? "ซ่อนโค้ด Mermaid" : "ดูโค้ด Mermaid"}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          showSource ? "bg-indigo-600/30 text-indigo-400" : "hover:bg-neutral-800 hover:text-white text-neutral-300"
        }`}
      >
        <Code className="w-4 h-4" />
      </button>

      {/* Copy Code */}
      <button
        type="button"
        onClick={onCopy}
        title="คัดลอกโค้ด Mermaid"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-300" />}
      </button>

      {/* Download SVG */}
      <button
        type="button"
        onClick={onDownloadSvg}
        title="ดาวน์โหลดเป็นไฟล์เวกเตอร์ SVG"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4" />
      </button>

      {/* Download PNG (Retina 2x) */}
      <button
        type="button"
        onClick={onDownloadPng}
        title="ดาวน์โหลดเป็นภาพ PNG คมชัด (2x Retina)"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer text-sky-400"
      >
        <ImageIcon className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-700 mx-1" />

      {/* Fullscreen */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        title={isFullscreen ? "ย่อหน้าจอ (Exit Fullscreen)" : "ขยายเต็มจอ (Fullscreen)"}
        className="p-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-indigo-400"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function MermaidChart({ chart }: MermaidChartProps) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.4));
  }, []);

  // Render mermaid
  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!chart || !chart.trim()) {
        if (isMounted) {
          setSvgContent("");
          setError(null);
        }
        return;
      }

      // ID must start with a letter for valid Mermaid element lookup
      const id = `m${Math.random().toString(36).substring(2, 9)}`;

      try {
        const { svg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : "Failed to render mermaid chart";
          setError(errMsg);
        }
        // Clean up any dangling error elements created by mermaid in document.body
        const dangling = document.getElementById(`d${id}`);
        if (dangling) dangling.remove();
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = (targetState?: boolean) => {
    setIsFullscreen((prev) => {
      const next = targetState !== undefined ? targetState : !prev;
      handleReset();
      return next;
    });
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || isFullscreen) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((prev) => Math.min(Math.max(prev + delta, 0.4), 4));
    }
  };

  // Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Copy Mermaid source code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy error message
  const handleCopyError = () => {
    if (!error) return;
    navigator.clipboard.writeText(`${error}\n\nCode:\n${chart}`);
    setErrorCopied(true);
    setTimeout(() => setErrorCopied(false), 2000);
  };

  // Download SVG
  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download high-resolution PNG (2x Retina scale)
  const handleDownloadPng = () => {
    if (!svgContent) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const svgElem = doc.querySelector("svg");
      if (!svgElem) return;

      const viewBox = svgElem.viewBox?.baseVal;
      const width = viewBox?.width || parseFloat(svgElem.getAttribute("width") || "800") || 800;
      const height = viewBox?.height || parseFloat(svgElem.getAttribute("height") || "600") || 600;

      const scaleFactor = 2; // 2x Retina
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(width * scaleFactor, 400);
      canvas.height = Math.max(height * scaleFactor, 300);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgXml = new XMLSerializer().serializeToString(svgElem);
      const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // High quality dark canvas background
        ctx.fillStyle = "#16161e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `diagram-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error("Failed to export diagram as PNG:", err);
    }
  };

  if (error) {
    return (
      <div className="my-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-xs font-mono shadow-lg">
        <div className="flex items-center justify-between gap-2 text-rose-400 font-semibold mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Mermaid Syntax Error</span>
          </div>
          <button
            type="button"
            onClick={handleCopyError}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
          >
            {errorCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{errorCopied ? "คัดลอกแล้ว" : "คัดลอกข้อผิดพลาด"}</span>
          </button>
        </div>
        <p className="text-rose-300/90 whitespace-pre-wrap leading-relaxed">{error}</p>
        <div className="mt-3">
          <div className="text-[11px] text-neutral-500 mb-1">Source Code:</div>
          <pre className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
            {chart}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inline Container */}
      <div className="relative group my-6 rounded-2xl border border-neutral-800 bg-[#16161e] shadow-lg overflow-hidden transition-all">
        {/* Floating Toolbar on Hover / Focus */}
        <div className="absolute top-3 right-3 z-10 opacity-75 group-hover:opacity-100 transition-opacity">
          <ChartToolbar
            scale={scale}
            copied={copied}
            showSource={showSource}
            isFullscreen={isFullscreen}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onCopy={handleCopyCode}
            onDownloadSvg={handleDownloadSvg}
            onDownloadPng={handleDownloadPng}
            onToggleSource={() => setShowSource((prev) => !prev)}
            onToggleFullscreen={() => toggleFullscreen()}
          />
        </div>

        {/* Pure Vector SVG Viewport (NO IFRAME) */}
        <div
          className={`w-full min-h-[260px] max-h-[580px] p-8 flex justify-center items-center overflow-hidden select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="inline-flex justify-center items-center pointer-events-auto max-w-full [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:drop-shadow-sm"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>

        {/* Collapsible Source Code Drawer */}
        {showSource && (
          <div className="border-t border-neutral-800 bg-neutral-950/90 p-4 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-2">
              <span className="flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mermaid Source Code</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-neutral-300 hover:text-white cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed">
              {chart}
            </pre>
          </div>
        )}

        {/* Footer Hint text */}
        <div className="px-4 py-2 bg-neutral-900/60 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>คลิกลากเพื่อเลื่อน (Pan) • Ctrl + ล้อเมาส์เพื่อซูม</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Pure Vector SVG</span>
          </span>
        </div>
      </div>

      {/* Fullscreen Interactive Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-sm font-semibold text-neutral-100">
                Mermaid Diagram Viewer (Fullscreen Vector)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ChartToolbar
                scale={scale}
                copied={copied}
                showSource={showSource}
                isFullscreen={isFullscreen}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onCopy={handleCopyCode}
                onDownloadSvg={handleDownloadSvg}
                onDownloadPng={handleDownloadPng}
                onToggleSource={() => setShowSource((prev) => !prev)}
                onToggleFullscreen={() => toggleFullscreen(false)}
              />
            </div>
          </div>

          {/* Fullscreen Canvas */}
          <div
            className={`flex-1 relative w-full h-full overflow-hidden flex items-center justify-center select-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              className="inline-flex justify-center items-center pointer-events-auto max-w-full [&_svg]:max-w-none [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-900/90 border border-neutral-700/60 px-5 py-2 rounded-full text-xs text-neutral-300 font-mono pointer-events-none shadow-2xl backdrop-blur-md">
              คลิกลากเพื่อเลื่อน • หมุนล้อเมาส์เพื่อซูมเข้า-ออก • กด ESC เพื่อออก
            </div>
          </div>
        </div>
      )}
    </>
  );
}
