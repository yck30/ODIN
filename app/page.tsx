"use client";

import { useEffect, useState } from "react";
import type { SystemEnvDiagnostics } from "@/lib/env";

interface HealthResponse {
  status: "operational" | "degraded" | "error";
  service: string;
  version: string;
  uptimeSeconds: number;
  diagnostics: SystemEnvDiagnostics;
}

export default function JarvisDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>("");

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString().replace("GMT", "UTC"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="app-container">
      {/* HUD Header */}
      <header className="jarvis-card stagger-item">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
              <h1 className="font-display" style={{ fontSize: "2rem", letterSpacing: "0.1em", color: "var(--text-primary)" }}>
                O.D.I.N.
              </h1>
              <span className="status-pill online">
                <span className="pulse-dot" />
                SYSTEM ONLINE
              </span>
              <span className="status-pill cyan">v1.2.0 (Phase 2)</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Operational Decision Intelligence Network — JARVIS Executive Interface
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
              {currentTime || "INITIALIZING CLOCK..."}
            </div>
            <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              VERCEL ZERO-COST RUNTIME
            </div>
          </div>
        </div>
      </header>

      {/* Grid: Health Telemetry & Architecture Layers */}
      <div className="hud-grid">
        {/* Environment Diagnostics Card */}
        <section className="jarvis-card stagger-item">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
              SYSTEM DIAGNOSTICS
            </h2>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="hud-button"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
            >
              {loading ? "PROBING..." : "RE-PROBE"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {/* Gemini Check */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Cognitive Engine (Gemini)</div>
                <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Model: {health?.diagnostics?.gemini?.model || "gemini-2.5-flash"}
                </div>
              </div>
              <span className={`status-pill ${health?.diagnostics?.gemini?.configured ? "online" : "warning"}`}>
                {health?.diagnostics?.gemini?.configured ? "CONNECTED" : "KEY REQUIRED"}
              </span>
            </div>

            {/* Supabase Check */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Supabase Vector DB</div>
                <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Postgres + pgvector
                </div>
              </div>
              <span className={`status-pill ${health?.diagnostics?.supabase?.urlConfigured ? "online" : "warning"}`}>
                {health?.diagnostics?.supabase?.urlConfigured ? "CONFIGURED" : "PENDING SETUP"}
              </span>
            </div>

            {/* Encryption Check */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>App-Layer AES-256</div>
                <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Narrative Encryption
                </div>
              </div>
              <span className={`status-pill ${health?.diagnostics?.encryption?.isValidLength ? "online" : "warning"}`}>
                {health?.diagnostics?.encryption?.isValidLength ? "ACTIVE (256-BIT)" : "PENDING KEY"}
              </span>
            </div>
          </div>
        </section>

        {/* 5-Layer Agent Architecture Status */}
        <section className="jarvis-card stagger-item">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--accent-blue)", letterSpacing: "0.06em" }}>
              AIM ARCHITECTURE LAYERS
            </h2>
            <span className="status-pill cyan">5/5 ARMED</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { id: "L1", name: "Memory Layer", role: "Constitution & RACI Bound", status: "Active" },
              { id: "L2", name: "Knowledge Layer", role: "Skills & Reasoning Prompts", status: "Loaded" },
              { id: "L3", name: "Guardrail Layer", role: "Gitleaks & Pre-Tool Interceptor", status: "Enforced" },
              { id: "L4", name: "Delegation Layer", role: "Specialized Reasoning Agents", status: "Ready" },
              { id: "L5", name: "Distribution Layer", role: "Vercel + GitHub Actions", status: "Standing By" },
            ].map((layer) => (
              <div
                key={layer.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  background: "var(--bg-card-subtle)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", fontWeight: 700 }}>
                    {layer.id}
                  </span>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{layer.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{layer.role}</div>
                  </div>
                </div>
                <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--accent-emerald)" }}>
                  {layer.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Milestone 1 Status & Next Steps */}
      <section className="jarvis-card stagger-item">
        <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "0.06em", marginBottom: "0.8rem" }}>
          PHASE 2 MILESTONE 1 (M1) — READINESS REPORT
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              STEP 1: SCAFFOLD
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Next.js 15 App Router</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              TypeScript, Vanilla CSS design tokens, zero-conflict coexistence with legacy Python engine.
            </p>
          </div>

          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              STEP 2: SECURITY
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Env Secrets & Gitleaks</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              .env.local isolated and gitignored; serverless routes protect all raw API keys.
            </p>
          </div>

          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              STEP 3: DEPLOYMENT
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Vercel Zero-Cost Tier</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Scaffold verified build-ready for continuous deployment upon git push.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
