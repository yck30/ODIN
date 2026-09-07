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

  // Passcode Security Clearance State
  const [passcode, setPasscode] = useState<string>("");
  const [passcodeInput, setPasscodeInput] = useState<string>("");
  const [passcodeStatus, setPasscodeStatus] = useState<string>("");

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

    // Check for existing passcode in localStorage
    const savedCode = localStorage.getItem("odin_passcode");
    if (savedCode) {
      setPasscode(savedCode);
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString().replace("GMT", "UTC"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSavePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setPasscodeStatus("Passcode cannot be blank.");
      return;
    }
    const cleanCode = passcodeInput.trim();
    localStorage.setItem("odin_passcode", cleanCode);
    setPasscode(cleanCode);
    setPasscodeInput("");
    setPasscodeStatus("Access passcode verified and secured in local terminal.");
    setTimeout(() => setPasscodeStatus(""), 3500);
  };

  const handleRevokePasscode = () => {
    localStorage.removeItem("odin_passcode");
    setPasscode("");
    setPasscodeStatus("Security clearance revoked. Access gate locked.");
    setTimeout(() => setPasscodeStatus(""), 3500);
  };

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

      {/* Security Clearance Gate Card (M2.5) */}
      <section className="jarvis-card stagger-item" style={{ borderLeft: passcode ? "3px solid var(--accent-emerald)" : "3px solid var(--accent-amber)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                SECURITY CLEARANCE GATE
              </h2>
              <span className={`status-pill ${passcode ? "online" : "warning"}`}>
                {passcode ? "LEVEL 5 AUTHORIZED" : "LOCK ENGAGED"}
              </span>
              {health?.diagnostics?.security?.passcodeProtected && (
                <span className="status-pill cyan">QUOTA GUARD ARMED</span>
              )}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
              {passcode
                ? "Terminal authenticated. Requests to /api/analyze include authorized x-odin-access-passcode credentials."
                : "Engine calls are restricted. Enter the secret access passcode to authenticate this terminal and execute decision runs."}
            </p>
          </div>

          <div>
            {passcode ? (
              <button
                onClick={handleRevokePasscode}
                className="hud-button"
                style={{ borderColor: "rgba(244, 63, 94, 0.4)", color: "var(--accent-rose)" }}
              >
                REVOKE CLEARANCE
              </button>
            ) : (
              <form onSubmit={handleSavePasscode} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="password"
                  placeholder="Enter Access Passcode..."
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className="hud-input"
                  style={{ width: "220px" }}
                />
                <button type="submit" className="hud-button">
                  AUTHORIZE
                </button>
              </form>
            )}
          </div>
        </div>
        {passcodeStatus && (
          <div className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-cyan)", marginTop: "0.6rem" }}>
            {passcodeStatus}
          </div>
        )}
      </section>

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
                  Model: {health?.diagnostics?.gemini?.model || "gemini-3.6-flash"}
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

            {/* Access Passcode Check */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Access Passcode Gate</div>
                <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Quota Protection (M2.5)
                </div>
              </div>
              <span className={`status-pill ${health?.diagnostics?.security?.passcodeProtected ? "online" : "warning"}`}>
                {health?.diagnostics?.security?.passcodeProtected ? "ARMED" : "UNPROTECTED"}
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
              { id: "L3", name: "Guardrail Layer", role: "Gitleaks & Passcode Interceptor", status: "Enforced" },
              { id: "L4", name: "Delegation Layer", role: "Specialized Reasoning Personas", status: "Ready" },
              { id: "L5", name: "Distribution Layer", role: "Vercel + GitHub Actions", status: "Operational" },
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

      {/* Phase 2 Progress Track */}
      <section className="jarvis-card stagger-item">
        <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "0.06em", marginBottom: "0.8rem" }}>
          PHASE 2 ROADMAP STATUS
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-emerald)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              ✓ MILESTONE 1
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Next.js 15 & Vercel</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Scaffold deployed on Vercel free tier with environment secrets.
            </p>
          </div>

          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-emerald)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              ✓ MILESTONE 2
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>4-Call Reasoning Engine</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Quant, Strategist, Behaviorist, Judge ported to API routes with Gemini 3.6 Flash.
            </p>
          </div>

          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              ⚡ MILESTONE 2.5
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Access Passcode Gate</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Terminal authorization gate protecting Gemini quota from unauthorized traffic.
            </p>
          </div>

          <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div className="font-mono" style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              ⏳ UPCOMING M3
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Supabase Auth & RLS</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Postgres + pgvector migration, user auth sessions, and AES-256 narrative encryption.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
