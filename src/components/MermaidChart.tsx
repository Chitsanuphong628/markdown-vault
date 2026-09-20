"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

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
  securityLevel: "loose",
});

interface MermaidChartProps {
  chart: string;
}

export default function MermaidChart({ chart }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to render mermaid chart");
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

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
    <div className="my-6 p-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex justify-center items-center overflow-x-auto shadow-inner">
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className="max-w-full"
      />
    </div>
  );
}
