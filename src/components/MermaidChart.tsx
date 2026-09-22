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
} from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#18181b",
    primaryColor: "#6366f1",
    primaryTextColor: "#f4f4f5",
    primaryBorderColor: "#818cf8",
    lineColor: "#a1a1aa",
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
  isFullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onToggleFullscreen: () => void;
}

function ChartToolbar({
  scale,
  copied,
  isFullscreen,
  onZoomIn,
  onZoomOut,
  onReset,
  onCopy,
  onDownload,
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

      <button
        type="button"
        onClick={onCopy}
        title="คัดลอกโค้ด Mermaid"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-300" />}
      </button>

      <button
        type="button"
        onClick={onDownload}
        title="ดาวน์โหลดเป็นภาพ SVG"
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-700 mx-1" />

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
  const [copied, setCopied] = useState(false);

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
      if (!chart) return;
      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
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
    // Prevent zooming interference unless modifier or in fullscreen
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

  if (error) {
    return (
      <div className="my-4 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono">
        <div className="font-bold mb-1">Mermaid Syntax Error:</div>
        <div>{error}</div>
        <pre className="mt-2 text-neutral-400 bg-neutral-900 p-2 rounded">{chart}</pre>
      </div>
    );
  }

  return (
    <>
      {/* Inline Container */}
      <div className="relative group my-6 rounded-2xl border border-neutral-800 bg-[#16161e] shadow-lg overflow-hidden">
        {/* Floating Toolbar on Hover / Focus */}
        <div className="absolute top-3 right-3 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
          <ChartToolbar
            scale={scale}
            copied={copied}
            isFullscreen={isFullscreen}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onCopy={handleCopyCode}
            onDownload={handleDownloadSvg}
            onToggleFullscreen={() => toggleFullscreen()}
          />
        </div>

        {/* Viewport for pan & zoom */}
        <div
          className={`w-full min-h-[260px] max-h-[580px] p-6 flex justify-center items-center overflow-hidden select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <iframe
            srcDoc={svgContent}
            sandbox=""
            title="Mermaid diagram"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
            }}
            className="inline-block pointer-events-none border-0 bg-transparent min-h-[240px] min-w-[320px]"
          />
        </div>

        {/* Hint text bottom right */}
        <div className="px-4 py-1.5 bg-neutral-900/60 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>คลิกลากเพื่อเลื่อน (Pan) • Ctrl + ล้อเมาส์เพื่อซูม</span>
          <span>Mermaid Diagram</span>
        </div>
      </div>

      {/* Fullscreen Modal Portal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-sm font-semibold text-neutral-200">Mermaid Diagram Viewer (Fullscreen)</span>
            </div>
            <div className="flex items-center gap-3">
              <ChartToolbar
                scale={scale}
                copied={copied}
                isFullscreen={isFullscreen}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onCopy={handleCopyCode}
                onDownload={handleDownloadSvg}
                onToggleFullscreen={() => toggleFullscreen(false)}
              />
            </div>
          </div>

          {/* Fullscreen Interactive Canvas */}
          <div
            className={`flex-1 relative w-full h-full overflow-hidden flex items-center justify-center select-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <iframe
              srcDoc={svgContent}
              sandbox=""
              title="Mermaid diagram fullscreen"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              className="inline-block pointer-events-none border-0 bg-transparent min-h-[240px] min-w-[320px]"
            />

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-900/80 border border-neutral-700/60 px-4 py-1.5 rounded-full text-xs text-neutral-400 font-mono pointer-events-none shadow-lg">
              คลิกลากเพื่อเลื่อนดู • หมุนล้อเมาส์เพื่อซูมเข้า-ออก • กด ESC เพื่อออก
            </div>
          </div>
        </div>
      )}
    </>
  );
}
