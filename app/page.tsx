"use client";

import { useEffect, useState } from "react";
import MermaidViewer from "@/components/MermaidViewer";
import type { SystemEnvDiagnostics } from "@/lib/env";
import type { FullAnalysisResult } from "@/lib/engine/types";

interface HealthResponse {
  status: "operational" | "degraded" | "error";
  service: string;
  version: string;
  uptimeSeconds: number;
  diagnostics: SystemEnvDiagnostics;
}

const SAMPLE_DILEMMA = {
  objectives: "Determine whether to pivot go-to-market from enterprise high-touch sales to self-serve Product-Led Growth (PLG).",
  constraints: "6 months of runway remaining ($300k cash). Team: 4 engineers, 1 sales lead. Enterprise sales cycle averages 5 months.",
  narrative: "We currently have 2 enterprise pilot contracts ($60k ARR each) in verbal agreement, but one prospect's procurement team has been unresponsive for 14 days. Meanwhile, our organic self-serve product is getting 120 signups/week with no paid acquisition, but free-to-paid conversion on the $39/mo tier is only 1.1%. The engineering team is pushing to scrap enterprise and focus 100% on PLG, while our lead investor insists on high-ACV enterprise accounts. We cannot afford to miss payroll in month 7.",
};

export default function JarvisDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Passcode Security Clearance State
  const [passcode, setPasscode] = useState<string>("");
  const [passcodeInput, setPasscodeInput] = useState<string>("");
  const [passcodeStatus, setPasscodeStatus] = useState<string>("");
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [verifyingPasscode, setVerifyingPasscode] = useState<boolean>(false);

  // Decision Intake Form State
  const [coreObjectives, setCoreObjectives] = useState<string>("");
  const [knownConstraints, setKnownConstraints] = useState<string>("");
  const [rawNarrative, setRawNarrative] = useState<string>("");

  // Analysis Execution State
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"judge" | "quant" | "strategist" | "behaviorist">("judge");

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/health");
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    // Verify stored passcode against server
    const savedCode = localStorage.getItem("odin_passcode");
    if (savedCode) {
      fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: savedCode }),
      })
        .then((res) => {
          if (res.ok) {
            setPasscode(savedCode);
          } else {
            localStorage.removeItem("odin_passcode");
            setPasscode("");
            setPasscodeStatus("Stored passcode was invalid and has been purged.");
            setTimeout(() => setPasscodeStatus(""), 4000);
          }
        })
        .catch(() => {
          // If server offline, keep local state
          setPasscode(savedCode);
        });
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString().replace("GMT", "UTC"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSavePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = passcodeInput.trim();
    if (!cleanCode) {
      setPasscodeStatus("Passcode cannot be blank.");
      return;
    }

    setVerifyingPasscode(true);
    setPasscodeStatus("Authenticating security credentials with server...");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: cleanCode }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        localStorage.setItem("odin_passcode", cleanCode);
        setPasscode(cleanCode);
        setPasscodeInput("");
        setPasscodeStatus("✓ Clearance authorized: Terminal authenticated.");
        setTimeout(() => setPasscodeStatus(""), 3500);
      } else {
        setPasscodeStatus(`✗ ${data.error || "Access Denied: Invalid passcode."}`);
      }
    } catch {
      setPasscodeStatus("✗ Authentication failed: Could not reach security endpoint.");
    } finally {
      setVerifyingPasscode(false);
    }
  };

  const handleRevokePasscode = () => {
    localStorage.removeItem("odin_passcode");
    setPasscode("");
    setPasscodeStatus("Security clearance revoked. Access gate locked.");
    setTimeout(() => setPasscodeStatus(""), 3500);
  };

  const handleLoadSample = () => {
    if (!passcode) return;
    setCoreObjectives(SAMPLE_DILEMMA.objectives);
    setKnownConstraints(SAMPLE_DILEMMA.constraints);
    setRawNarrative(SAMPLE_DILEMMA.narrative);
  };

  const handleClearForm = () => {
    if (!passcode && !coreObjectives && !knownConstraints && !rawNarrative) return;
    setCoreObjectives("");
    setKnownConstraints("");
    setRawNarrative("");
    setAnalysisResult(null);
    setAnalysisError("");
  };

  const handleExecuteAnalysis = async () => {
    if (!passcode) {
      setAnalysisError("Security clearance required. Please authorize with a valid passcode above.");
      return;
    }
    setAnalysisError("");
    setAnalysisResult(null);
    setAnalyzing(true);
    setAnalysisStage("Initializing cognitive personas...");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (passcode) {
        headers["x-odin-access-passcode"] = passcode;
      }

      const response = await fetch("/api/analyze?stream=true", {
        method: "POST",
        headers,
        body: JSON.stringify({
          core_objectives: coreObjectives,
          known_constraints: knownConstraints,
          raw_narrative: rawNarrative,
          stream: true,
          passcode: passcode || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to open streaming response reader.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.replace("event: ", "").trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === "progress") {
                setAnalysisStage(`[Stage ${parsed.step}/${parsed.totalSteps}] ${parsed.message}`);
              } else if (currentEvent === "complete") {
                setAnalysisResult(parsed);
                setActiveTab("judge");
                setAnalysisStage("Cognitive synthesis complete.");
              } else if (currentEvent === "error") {
                throw new Error(parsed.message || "Execution error in engine.");
              }
            } catch (err: unknown) {
              if (currentEvent === "error") {
                throw err;
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Cognitive execution encountered an error.");
    } finally {
      setAnalyzing(false);
    }
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
              <h2 className="font-display" style={{ fontSize: "1.05rem", color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                SECURITY CLEARANCE GATE
              </h2>
              <span className={`status-pill ${passcode ? "online" : "warning"}`}>
                {passcode ? "LEVEL 5 AUTHORIZED" : "PASSCODE REQUIRED"}
              </span>
              {health?.diagnostics?.security?.passcodeProtected && (
                <span className="status-pill cyan">QUOTA GUARD ARMED</span>
              )}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
              {passcode
                ? "Terminal authenticated. Requests to /api/analyze automatically attach authorized security credentials."
                : "Engine calls are gated against unauthorized public bot traffic. Enter the secret access passcode to unlock the terminal."}
            </p>
          </div>

          <div>
            {passcode ? (
              <button
                onClick={handleRevokePasscode}
                className="hud-button"
                style={{ borderColor: "rgba(244, 63, 94, 0.4)", color: "var(--accent-rose)", fontSize: "0.75rem" }}
              >
                REVOKE CLEARANCE
              </button>
            ) : (
              <form onSubmit={handleSavePasscode} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  <input
                    type={showPasscode ? "text" : "password"}
                    placeholder="Enter Access Passcode..."
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    className="hud-input"
                    style={{ width: "230px", paddingRight: "2.4rem" }}
                    disabled={verifyingPasscode}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    title={showPasscode ? "Hide Passcode" : "Show Passcode"}
                    style={{
                      position: "absolute",
                      right: "0.5rem",
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      padding: "0.2rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showPasscode ? "🙈" : "👁️"}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={verifyingPasscode || !passcodeInput.trim()}
                  className="hud-button"
                  style={{ fontSize: "0.75rem" }}
                >
                  {verifyingPasscode ? "AUTHENTICATING..." : "AUTHORIZE"}
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

      {/* Decision Intake Console */}
      <section className="jarvis-card stagger-item">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 className="font-display" style={{ fontSize: "1.2rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
                DECISION INTAKE CONSOLE
              </h2>
              <span className={`status-pill ${passcode ? "online" : "warning"}`}>
                {passcode ? "READY" : "LOCKED"}
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              Submit high-stakes dilemmas for 4-persona mathematical, strategic, and behavioral arbitration.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleLoadSample}
              disabled={!passcode || analyzing}
              className="hud-button"
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
              title={!passcode ? "Authorize passcode above to load sample dilemma" : "Load sample dilemma"}
            >
              LOAD SAMPLE DILEMMA
            </button>
            <button
              onClick={handleClearForm}
              disabled={!passcode || analyzing}
              className="hud-button"
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}
              title={!passcode ? "Terminal is locked" : "Clear fields"}
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Lock Banner when Unauthorized */}
        {!passcode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.85rem 1.1rem",
              marginBottom: "1.2rem",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px dashed rgba(245, 158, 11, 0.45)",
              borderRadius: "8px",
              color: "var(--accent-amber)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🔒</span>
              <div>
                <div className="font-mono" style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  TERMINAL LOCKED — SECURITY CLEARANCE REQUIRED
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  All intake fields and reasoning synthesis controls are locked. Please authenticate via the Security Clearance Gate above to initialize the terminal.
                </div>
              </div>
            </div>
            <span className="status-pill warning" style={{ whiteSpace: "nowrap" }}>
              GATE RESTRICTED
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="font-mono" style={{ display: "block", fontSize: "0.78rem", color: "var(--accent-cyan)", marginBottom: "0.4rem" }}>
              CORE OBJECTIVES (PRIMARY OUTCOMES) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
            </label>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter core objectives..." : "e.g. Determine whether to pivot GTM strategy from enterprise direct sales to self-serve PLG..."}
              value={coreObjectives}
              onChange={(e) => setCoreObjectives(e.target.value)}
              disabled={!passcode || analyzing}
              rows={2}
            />
          </div>

          <div>
            <label className="font-mono" style={{ display: "block", fontSize: "0.78rem", color: "var(--accent-blue)", marginBottom: "0.4rem" }}>
              KNOWN CONSTRAINTS (RUNWAY, CAPITAL, TIMELINE, TEAMS) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
            </label>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter constraints..." : "e.g. 6 months of cash remaining ($300k). 4 engineers, 1 sales lead. Must achieve cash flow break-even before month 7..."}
              value={knownConstraints}
              onChange={(e) => setKnownConstraints(e.target.value)}
              disabled={!passcode || analyzing}
              rows={2}
            />
          </div>

          <div>
            <label className="font-mono" style={{ display: "block", fontSize: "0.78rem", color: "var(--accent-indigo)", marginBottom: "0.4rem" }}>
              RAW NARRATIVE (FULL SITUATIONAL CONTEXT & CONFLICTING SIGNALS) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
            </label>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter narrative context..." : "Describe the full backstory, conflicting internal opinions, external risks, procurement delays, customer signals, and dilemma..."}
              value={rawNarrative}
              onChange={(e) => setRawNarrative(e.target.value)}
              disabled={!passcode || analyzing}
              rows={4}
            />
          </div>

          {analysisError && (
            <div style={{ padding: "0.8rem 1rem", background: "rgba(244, 63, 94, 0.12)", border: "1px solid var(--accent-rose)", borderRadius: "8px", color: "#fda4af", fontSize: "0.85rem" }}>
              <strong>Execution Error:</strong> {analysisError}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Section 20 Protocol: Quant → Strategist → Behaviorist → Judge (Gemini 3.6 Flash)
            </div>
            <button
              onClick={handleExecuteAnalysis}
              disabled={!passcode || analyzing || !coreObjectives.trim() || !knownConstraints.trim() || !rawNarrative.trim()}
              className="hud-button"
              style={{
                padding: "0.8rem 1.75rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                ...(!passcode ? { borderColor: "rgba(245, 158, 11, 0.4)", color: "var(--accent-amber)" } : {}),
              }}
            >
              {!passcode
                ? "🔒 CLEARANCE REQUIRED TO EXECUTE"
                : analyzing
                ? "COGNITIVE SYNTHESIS IN PROGRESS..."
                : "EXECUTE DECISION ANALYSIS"}
            </button>
          </div>
        </div>

        {/* Live Streaming Stage Indicator */}
        {analyzing && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(0, 240, 255, 0.06)", border: "1px solid var(--accent-cyan)", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="pulse-dot" />
              <span className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                {analysisStage}
              </span>
            </div>
            <div style={{ marginTop: "0.75rem", height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: analysisStage.includes("Stage 1")
                    ? "25%"
                    : analysisStage.includes("Stage 2")
                    ? "50%"
                    : analysisStage.includes("Stage 3")
                    ? "75%"
                    : analysisStage.includes("Stage 4")
                    ? "95%"
                    : "15%",
                  background: "var(--accent-cyan)",
                  boxShadow: "var(--glow-cyan-sm)",
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Analysis Deliverables Panel (Rendered on Complete) */}
      {analysisResult && (
        <section className="jarvis-card stagger-item">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="font-display" style={{ fontSize: "1.3rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
                COGNITIVE SYNTHESIS DELIVERABLES
              </h2>
              <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                Computed in {(analysisResult.metadata.totalDurationMs / 1000).toFixed(1)}s via {analysisResult.metadata.model}
              </div>
            </div>

            {/* Persona Tabs */}
            <div className="hud-tabs" style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
              <button
                onClick={() => setActiveTab("judge")}
                className={`hud-tab ${activeTab === "judge" ? "active" : ""}`}
              >
                THE JUDGE (ARBITRATION)
              </button>
              <button
                onClick={() => setActiveTab("quant")}
                className={`hud-tab ${activeTab === "quant" ? "active" : ""}`}
              >
                THE QUANT
              </button>
              <button
                onClick={() => setActiveTab("strategist")}
                className={`hud-tab ${activeTab === "strategist" ? "active" : ""}`}
              >
                THE STRATEGIST
              </button>
              <button
                onClick={() => setActiveTab("behaviorist")}
                className={`hud-tab ${activeTab === "behaviorist" ? "active" : ""}`}
              >
                THE BEHAVIORIST
              </button>
            </div>
          </div>

          {/* TAB 1: THE JUDGE */}
          {activeTab === "judge" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Recommended Path Banner */}
              <div style={{ padding: "1.25rem", background: "rgba(0, 240, 255, 0.08)", border: "1px solid var(--accent-cyan)", borderRadius: "8px" }}>
                <div className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-cyan)", marginBottom: "0.3rem" }}>
                  DEFINITIVE ARBITRATION VERDICT:
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  &quot;{analysisResult.judge.recommended_path}&quot;
                </div>
              </div>

              {/* Sequenced Next 3 Actions */}
              <div>
                <h3 className="font-display" style={{ fontSize: "1rem", color: "var(--accent-blue)", marginBottom: "0.75rem" }}>
                  SEQUENCED NEXT 3 ACTIONS (FIRST PRINCIPLES)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                  {analysisResult.judge.next_3_actions.map((act, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "1rem",
                        background: "var(--bg-card-subtle)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        position: "relative",
                      }}
                    >
                      <div className="font-mono" style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--accent-cyan)", marginBottom: "0.4rem" }}>
                        0{index + 1}
                      </div>
                      <p style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text-primary)" }}>{act}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flowchart Diagram */}
              {analysisResult.judge.mermaid_diagram && (
                <div>
                  <h3 className="font-display" style={{ fontSize: "1rem", color: "var(--accent-indigo)", marginBottom: "0.75rem" }}>
                    DECISION FLOWCHART & BRANCH POINTS
                  </h3>
                  <MermaidViewer chart={analysisResult.judge.mermaid_diagram} />
                </div>
              )}

              {/* Tension Points & Full Synthesis */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.2rem" }}>
                <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-amber)", marginBottom: "0.5rem" }}>
                    IDENTIFIED TENSION POINTS
                  </h4>
                  <ul style={{ paddingLeft: "1.2rem", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {analysisResult.judge.tension_points.map((tp, i) => (
                      <li key={i}>{tp}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginBottom: "0.5rem" }}>
                    SYNTHESIS NARRATIVE
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {analysisResult.judge.synthesis}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE QUANT */}
          {activeTab === "quant" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Operations Research & Expected Value</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{analysisResult.quant.summary}</p>
                </div>
                <span className="status-pill cyan">Confidence: {analysisResult.quant.confidence}</span>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginBottom: "0.75rem" }}>
                  IDENTIFIED DECISION PATHS & PROBABILITIES
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {analysisResult.quant.paths.map((p, i) => (
                    <div key={i} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</span>
                        <span className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem" }}>
                          {p.probability !== null ? `P: ${(p.probability * 100).toFixed(0)}%` : "Qualitative EV"}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{p.expected_value_notes}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-blue)", marginBottom: "0.5rem" }}>
                  DETAILED QUANTITATIVE REASONING
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                  {analysisResult.quant.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: THE STRATEGIST */}
          {activeTab === "strategist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Game Theory & Reversibility Ranking</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{analysisResult.strategist.summary}</p>
                </div>
                <span className={`status-pill ${analysisResult.strategist.domain_framing === "adversarial" ? "warning" : "online"}`}>
                  Domain: {analysisResult.strategist.domain_framing}
                </span>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginBottom: "0.75rem" }}>
                  STRATEGIC REVERSIBILITY RANKING (ORDERED BY RISK)
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {analysisResult.strategist.reversibility_ranking.map((m, i) => (
                    <div key={i} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.move}</span>
                        <span
                          className={`status-pill ${
                            m.reversibility === "high" ? "online" : m.reversibility === "medium" ? "warning" : "cyan"
                          }`}
                        >
                          Reversibility: {m.reversibility}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{m.notes}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-blue)", marginBottom: "0.5rem" }}>
                  STRATEGIC REASONING
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                  {analysisResult.strategist.reasoning}
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: THE BEHAVIORIST */}
          {activeTab === "behaviorist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Cognitive Bias Audit & Blind Spots</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{analysisResult.behaviorist.summary}</p>
                </div>
                <span className="status-pill cyan">Confidence: {analysisResult.behaviorist.confidence}</span>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginBottom: "0.75rem" }}>
                  COGNITIVE BIASES AUDITED
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
                  {analysisResult.behaviorist.biases_detected.map((b, i) => (
                    <div key={i} style={{ padding: "0.75rem", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                        <span className="font-mono" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--accent-cyan)" }}>
                          {b.bias}
                        </span>
                        <span className={`status-pill ${b.present ? "warning" : "online"}`}>
                          {b.present ? "DETECTED" : "RULED OUT"}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                        &quot;{b.evidence}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "1rem", background: "var(--bg-card-subtle)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <h4 className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-blue)", marginBottom: "0.5rem" }}>
                  BEHAVIORAL AUDIT
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                  {analysisResult.behaviorist.reasoning}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

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
              disabled={loadingHealth}
              className="hud-button"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
            >
              {loadingHealth ? "PROBING..." : "RE-PROBE"}
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
    </main>
  );
}
