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
import { addSvgBackground, MERMAID_EXPORT_BACKGROUND } from "./charts/mermaidGenerators";
import { I18N_DIAGRAM, type Language } from "@/lib/i18n";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: MERMAID_EXPORT_BACKGROUND,
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
  lang?: Language;
  studio?: boolean;
  onValidationChange?: (code: string, valid: boolean) => void;
}

interface ChartToolbarProps {
  lang: Language;
  scale: number;
  copied: boolean;
  copyFailed: boolean;
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
  hideSource?: boolean;
  compact?: boolean;
}

function ChartToolbar({
  lang,
  scale,
  copied,
  copyFailed,
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
  hideSource = false,
  compact = false,
}: ChartToolbarProps) {
  const t = I18N_DIAGRAM[lang];
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1.5 text-neutral-300 text-xs select-none ${compact ? "bg-transparent" : "rounded-xl border border-neutral-700/60 bg-neutral-900/90 shadow-xl"}`}>
      <button
        type="button"
        onClick={onZoomIn}
        title={t.zoomIn}
        aria-label={t.zoomIn}
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
        title={t.zoomOut}
        aria-label={t.zoomOut}
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        title={t.resetView}
        aria-label={t.resetView}
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-700 mx-1" />

      {/* Toggle View Source Code */}
      {!hideSource && <button
        type="button"
        onClick={onToggleSource}
        title={showSource ? t.hideSource : t.showSource}
        aria-label={showSource ? t.hideSource : t.showSource}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          showSource ? "bg-indigo-600/30 text-indigo-400" : "hover:bg-neutral-800 hover:text-white text-neutral-300"
        }`}
      >
        <Code className="w-4 h-4" />
      </button>}

      {/* Copy Code */}
      <button
        type="button"
        onClick={onCopy}
        title={copyFailed ? t.copyFailed : t.copySource}
        aria-label={copyFailed ? t.copyFailed : t.copySource}
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : copyFailed ? <AlertCircle className="w-4 h-4 text-rose-300" /> : <Copy className="w-4 h-4 text-neutral-300" />}
      </button>

      {/* Download SVG */}
      <button
        type="button"
        onClick={onDownloadSvg}
        title={t.downloadSvg}
        aria-label={t.downloadSvg}
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4" />
      </button>

      {/* Download PNG (Retina 2x) */}
      <button
        type="button"
        onClick={onDownloadPng}
        title={t.downloadPng}
        aria-label={t.downloadPng}
        className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer text-sky-400"
      >
        <ImageIcon className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-700 mx-1" />

      {/* Fullscreen */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        title={isFullscreen ? t.exitFullscreen : t.fullscreen}
        aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
        className="p-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer text-indigo-400"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
      {copyFailed && <span role="status" className="sr-only">{t.copyFailed}</span>}
    </div>
  );
}

export default function MermaidChart({ chart, lang = "en", studio = false, onValidationChange }: MermaidChartProps) {
  const t = I18N_DIAGRAM[lang];
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
  const [copyFailed, setCopyFailed] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState("");

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
          onValidationChange?.(chart, false);
        }
        return;
      }

      // ID must start with a letter for valid Mermaid element lookup
      const id = `m${Math.random().toString(36).substring(2, 9)}`;

      try {
        const { svg } = await mermaid.render(id, chart);
        const svgWithBackground = chart.includes(`'background':'${MERMAID_EXPORT_BACKGROUND}'`)
          ? addSvgBackground(svg)
          : svg;
        if (isMounted) {
          setSvgContent(svgWithBackground);
          setError(null);
          onValidationChange?.(chart, true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : "Failed to render mermaid chart";
          setSvgContent("");
          setError(errMsg);
          onValidationChange?.(chart, false);
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
  }, [chart, onValidationChange]);

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
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  // Copy error message
  const handleCopyError = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(`${error}\n\nCode:\n${chart}`);
      setCopyFailed(false);
      setErrorCopied(true);
      setTimeout(() => setErrorCopied(false), 2000);
    } catch {
      setErrorCopied(false);
      setCopyFailed(true);
    }
  };

  // Download SVG
  const handleDownloadSvg = () => {
    if (!svgContent) return;
    setExportNotice("");
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
    setExportNotice("");
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const svgElem = doc.querySelector("svg");
      if (!svgElem) { setExportNotice(t.exportFailed); return; }

      const viewBox = svgElem.viewBox?.baseVal;
      const width = viewBox?.width || parseFloat(svgElem.getAttribute("width") || "800") || 800;
      const height = viewBox?.height || parseFloat(svgElem.getAttribute("height") || "600") || 600;

      const scaleFactor = 2; // 2x Retina
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(width * scaleFactor, 400);
      canvas.height = Math.max(height * scaleFactor, 300);
      const ctx = canvas.getContext("2d");
      if (!ctx) { setExportNotice(t.exportFailed); return; }

      const img = new Image();
      const svgXml = new XMLSerializer().serializeToString(svgElem);
      const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // High quality dark canvas background
        ctx.fillStyle = MERMAID_EXPORT_BACKGROUND;
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
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setExportNotice(t.exportFailed);
      };
      img.src = url;
    } catch (err) {
      console.error("Failed to export diagram as PNG:", err);
      setExportNotice(t.exportFailed);
    }
  };

  if (error) {
    return (
      <div className={`${studio ? "my-3 rounded-md" : "my-5 rounded-2xl shadow-lg"} border border-rose-500/30 bg-rose-950/20 p-5 text-xs font-mono`}>
        <div className="flex items-center justify-between gap-2 text-rose-400 font-semibold mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t.syntaxError}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyError()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
          >
            {errorCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{errorCopied ? t.copied : t.copyError}</span>
          </button>
        </div>
        <p className="text-rose-300/90 whitespace-pre-wrap leading-relaxed">{error}</p>
        {!studio && <div className="mt-3">
          <div className="text-[11px] text-neutral-500 mb-1">{t.source}</div>
          <pre className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
            {chart}
          </pre>
        </div>}
      </div>
    );
  }

  return (
    <>
      {/* Inline Container */}
      <div className={`relative group border border-neutral-800 bg-[#161922] overflow-hidden ${studio ? "my-3 rounded-md" : "my-6 rounded-2xl shadow-lg"}`}>
        {/* Floating Toolbar on Hover / Focus */}
        <div className={studio ? "flex justify-end overflow-x-auto border-b border-neutral-800 p-2" : "absolute top-3 right-3 z-10 opacity-75 group-hover:opacity-100 transition-opacity"}>
          <ChartToolbar
            lang={lang}
            scale={scale}
            copied={copied}
            copyFailed={copyFailed}
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
            hideSource={studio}
            compact={studio}
          />
        </div>
        {exportNotice && <div role="alert" className="absolute bottom-2 left-2 z-20 rounded bg-rose-950/95 px-3 py-2 text-xs text-rose-200">{exportNotice}</div>}

        {/* Pure Vector SVG Viewport (NO IFRAME) */}
        <div
          className={`w-full min-h-[260px] p-4 sm:p-8 flex justify-center items-center select-none ${studio ? "overflow-visible" : "max-h-[580px] overflow-hidden"} ${
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
                <span>{t.source}</span>
              </span>
              <button
                type="button"
          onClick={() => void handleCopyCode()}
                className="flex items-center gap-1 text-neutral-300 hover:text-white cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed">
              {chart}
            </pre>
          </div>
        )}

        {/* Footer Hint text */}
        {!studio && <div className="px-4 py-2 bg-neutral-900/60 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>{t.dragHint}</span>
          <span>{t.vector}</span>
        </div>}
      </div>

      {/* Fullscreen Interactive Modal */}
      {isFullscreen && (
        <div data-mermaid-fullscreen="true" className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-sm font-semibold text-neutral-100">
                {lang === "th" ? "แผนภาพ Mermaid" : "Mermaid diagram"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ChartToolbar
          lang={lang}
          scale={scale}
          copied={copied}
          copyFailed={copyFailed}
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
              {t.wheelHint}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
