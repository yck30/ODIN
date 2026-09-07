"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#0a1124",
    primaryColor: "#0e1e38",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#00f0ff",
    lineColor: "#38bdf8",
    secondaryColor: "#132142",
    tertiaryColor: "#050811",
  },
});

interface MermaidViewerProps {
  chart: string;
}

export default function MermaidViewer({ chart }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!chart) return;
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvgContent(svg);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to render graphic flowchart. Raw diagram displayed below.");
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
      <div style={{ padding: "1rem", background: "rgba(0,0,0,0.4)", borderRadius: "8px" }}>
        <p style={{ color: "var(--accent-amber)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>
        <pre className="font-mono" style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", overflowX: "auto" }}>
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        overflowX: "auto",
        padding: "1.5rem",
        background: "rgba(5, 8, 17, 0.7)",
        borderRadius: "8px",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
