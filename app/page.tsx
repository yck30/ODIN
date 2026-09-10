"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import MermaidViewer from "@/components/MermaidViewer";
import VoiceMicButton from "@/components/VoiceMicButton";
import VoiceReadbackController from "@/components/VoiceReadbackController";
import CaseHistoryDrawer, { SessionSummary } from "@/components/CaseHistoryDrawer";
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

export default function OdinCommandDashboard() {
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

  // Case History State (Milestone 5)
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const [isWakingArchive, setIsWakingArchive] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<"intake" | "history">("intake");
  const [historicMetadata, setHistoricMetadata] = useState<{ id: string; created_at: string } | null>(null);

  // Outcome feedback loop state (Milestones N2 & N3)
  const [currentSessionOutcome, setCurrentSessionOutcome] = useState<{
    id?: string;
    status: "followed_path" | "deviated" | "still_deciding";
    narrative?: string | null;
    recorded_at?: string;
  } | null>(null);

  // Opportunistic Precedent Prompt state (FR-27)
  const [opportunisticPrecedent, setOpportunisticPrecedent] = useState<{
    id: string;
    date: string;
    core_objectives: string;
    synthesis: string;
    similarity?: number;
  } | null>(null);

  // Manual outcome modal state from deliverables panel (FR-30)
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [modalOutcomeStatus, setModalOutcomeStatus] = useState<"followed_path" | "deviated" | "still_deciding">("followed_path");
  const [modalOutcomeNarrative, setModalOutcomeNarrative] = useState("");
  const [isSavingModalOutcome, setIsSavingModalOutcome] = useState(false);

  // Abort Controller & Keyboard Accelerator Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputsRef = useRef({
    passcode,
    analyzing,
    coreObjectives,
    knownConstraints,
    rawNarrative,
    opportunisticPrecedent,
    isOutcomeModalOpen,
    dashboardMode,
  });
  inputsRef.current = {
    passcode,
    analyzing,
    coreObjectives,
    knownConstraints,
    rawNarrative,
    opportunisticPrecedent,
    isOutcomeModalOpen,
    dashboardMode,
  };

  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setAnalyzing(false);
      setAnalysisStage("Synthesis aborted by command.");
      setAnalysisError("Cognitive synthesis aborted by user command [ESC].");
    }
  }, []);

  const fetchSessions = async (activeCode?: string) => {
    const code = activeCode || passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") : "") || "";
    if (!code) return;

    setLoadingSessions(true);
    setIsWakingArchive(false);

    // If Supabase free tier is waking after inactivity, show PRD status string
    const wakingTimer = setTimeout(() => {
      setIsWakingArchive(true);
    }, 2000);

    try {
      const res = await fetch("/api/sessions", {
        headers: {
          "x-odin-access-passcode": code,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions || []);
      }
    } catch (e) {
      console.warn("Failed to fetch sessions from archive:", e);
    } finally {
      clearTimeout(wakingTimer);
      setLoadingSessions(false);
      setIsWakingArchive(false);
    }
  };

  const handleReopenSession = async (id: string) => {
    const code = passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") : "") || "";
    if (!code) return;

    setAnalyzing(true);
    setAnalysisStage("Decrypting historic session narrative from Supabase (FR-15 & FR-17)...");
    setAnalysisError("");

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        headers: { "x-odin-access-passcode": code },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load session from database.");
      }
      const data = await res.json();
      const session = data.data;

      setCoreObjectives(session.intake.core_objectives || "");
      setKnownConstraints(session.intake.known_constraints || "");
      setRawNarrative(session.intake.raw_narrative || "");

      setAnalysisResult({
        ...session.outputs,
        metadata: {
          totalDurationMs: 0,
          model: session.embedding_model || "Supabase Persistent Vector Archive",
        },
      });

      setActiveSessionId(session.id);
      setHistoricMetadata({ id: session.id, created_at: session.created_at });
      setCurrentSessionOutcome(session.outcome || null);
      setActiveTab("judge");
      setDashboardMode("intake");

      setTimeout(() => {
        const elem = document.getElementById("deliverables-panel");
        if (elem) {
          elem.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to re-open session.");
    } finally {
      setAnalyzing(false);
      setAnalysisStage("");
    }
  };

  const handleDeleteSession = async (id: string) => {
    const code = passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") : "") || "";
    if (!code) return;

    const res = await fetch(`/api/sessions/${id}`, {
      method: "DELETE",
      headers: { "x-odin-access-passcode": code },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete session");
    }

    setSessionsList((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setHistoricMetadata(null);
      setAnalysisResult(null);
    }
  };

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

  const executeAnalysisRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const runStreamingAnalysisRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    fetchHealth();

    // Verify stored passcode against server (sessionStorage + localStorage sync)
    const savedCode =
      (typeof window !== "undefined"
        ? sessionStorage.getItem("odin_passcode") || localStorage.getItem("odin_passcode")
        : "") || "";

    if (savedCode) {
      fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: savedCode }),
      })
        .then((res) => {
          if (res.ok) {
            setPasscode(savedCode);
            sessionStorage.setItem("odin_passcode", savedCode);
            localStorage.setItem("odin_passcode", savedCode);
            fetchSessions(savedCode);
          } else {
            sessionStorage.removeItem("odin_passcode");
            localStorage.removeItem("odin_passcode");
            setPasscode("");
            setPasscodeStatus("Stored passcode was invalid and has been purged.");
            setTimeout(() => setPasscodeStatus(""), 4000);
          }
        })
        .catch(() => {
          // If server offline, keep local state
          setPasscode(savedCode);
          fetchSessions(savedCode);
        });
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString().replace("GMT", "UTC"));
    }, 1000);

    // Global Power-User Keyboard Accelerators ($impeccable adapt)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter: Execute Synthesis
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const { passcode: p, analyzing: a, coreObjectives: o, knownConstraints: c, rawNarrative: n } = inputsRef.current;
        if (p && !a && o.trim() && c.trim() && n.trim()) {
          e.preventDefault();
          executeAnalysisRef.current();
        }
      }
      // Escape: Abort in-flight run or dismiss modals/history
      if (e.key === "Escape") {
        const { analyzing: a, opportunisticPrecedent: opp, isOutcomeModalOpen: omo, dashboardMode: dm } = inputsRef.current;
        if (a) {
          e.preventDefault();
          handleAbort();
        } else if (opp) {
          e.preventDefault();
          setOpportunisticPrecedent(null);
          runStreamingAnalysisRef.current();
        } else if (omo) {
          e.preventDefault();
          setIsOutcomeModalOpen(false);
        } else if (dm === "history") {
          e.preventDefault();
          setDashboardMode("intake");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleAbort]);

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
        sessionStorage.setItem("odin_passcode", cleanCode);
        localStorage.setItem("odin_passcode", cleanCode);
        setPasscode(cleanCode);
        fetchSessions(cleanCode);
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
    sessionStorage.removeItem("odin_passcode");
    localStorage.removeItem("odin_passcode");
    setPasscode("");
    setSessionsList([]);
    setActiveSessionId(null);
    setHistoricMetadata(null);
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

  const runStreamingAnalysis = async () => {
    setAnalysisError("");
    setAnalysisResult(null);
    setCurrentSessionOutcome(null);
    setAnalyzing(true);
    setAnalysisStage("Initializing cognitive personas...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        signal: controller.signal,
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
                if (parsed.sessionId) {
                  setActiveSessionId(parsed.sessionId);
                  setHistoricMetadata({ id: parsed.sessionId, created_at: new Date().toISOString() });
                }
                fetchSessions();
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
      if (err instanceof DOMException && err.name === "AbortError") {
        setAnalysisStage("Synthesis aborted by command.");
        setAnalysisError("Cognitive synthesis aborted by user command [ESC].");
      } else {
        setAnalysisError(err instanceof Error ? err.message : "Cognitive execution encountered an error.");
      }
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleExecuteAnalysis = async () => {
    if (!passcode) {
      setAnalysisError("Security clearance required. Please authorize with a valid passcode above.");
      return;
    }

    // FR-27 Opportunistic Outcome Capture: Check for high-similarity precedent lacking an outcome
    try {
      const checkRes = await fetch("/api/recall/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          core_objectives: coreObjectives,
          known_constraints: knownConstraints,
        }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.pendingPrecedent) {
          setOpportunisticPrecedent(checkData.pendingPrecedent);
          return; // Pause flow to present 1-tap outcome question
        }
      }
    } catch (checkErr) {
      console.warn("Opportunistic pre-check notice:", checkErr);
    }

    await runStreamingAnalysis();
  };

  runStreamingAnalysisRef.current = runStreamingAnalysis;
  executeAnalysisRef.current = handleExecuteAnalysis;

  const handleOpportunisticDecision = async (status?: "followed_path" | "deviated" | "still_deciding") => {
    const precedent = opportunisticPrecedent;
    setOpportunisticPrecedent(null);

    if (status && precedent) {
      try {
        const code = passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") : "") || "";
        await fetch(`/api/sessions/${precedent.id}/outcomes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-odin-access-passcode": code,
          },
          body: JSON.stringify({
            status,
            prompted_via: "opportunistic",
            passcode: code,
          }),
        });
        fetchSessions();
      } catch (e) {
        console.warn("Could not save opportunistic outcome:", e);
      }
    }

    await runStreamingAnalysis();
  };

  const handleSaveModalOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId) return;
    setIsSavingModalOutcome(true);

    try {
      const code = passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") : "") || "";
      const res = await fetch(`/api/sessions/${activeSessionId}/outcomes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-odin-access-passcode": code,
        },
        body: JSON.stringify({
          status: modalOutcomeStatus,
          narrative: modalOutcomeNarrative.trim(),
          prompted_via: "manual",
          passcode: code,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentSessionOutcome({
          status: data.outcome.status,
          narrative: data.outcome.narrative,
          recorded_at: data.outcome.recorded_at,
        });
        setIsOutcomeModalOpen(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to save outcome from modal:", err);
    } finally {
      setIsSavingModalOutcome(false);
    }
  };

  return (
    <main className="app-container">
      {/* HUD Header */}
      <header className="hud-card stagger-item">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
              <h1 className="font-display" style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", letterSpacing: "0.08em", color: "var(--text-primary)" }}>
                O.D.I.N.
              </h1>
              <span className="status-pill online">
                <span className="pulse-dot" />
                SYSTEM ONLINE
              </span>
              <span className="status-pill cyan">v1.2.0 (Phase 2)</span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Operational Decision Intelligence Network — Cybernetic Command Console
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="font-mono" style={{ fontSize: "0.85rem", color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
              {currentTime || "INITIALIZING CLOCK..."}
            </div>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              VERCEL ZERO-COST RUNTIME
            </div>
          </div>
        </div>
      </header>

      {/* Security Clearance Gate Card (M2.5) */}
      <section
        className="hud-card stagger-item"
        style={{
          border: passcode ? "1px solid var(--border-emerald)" : "1px solid var(--border-amber)",
          boxShadow: passcode ? "var(--glow-cyan-sm)" : "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
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
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.3rem", lineHeight: 1.5 }}>
              {passcode
                ? "Terminal authenticated. Requests to /api/analyze automatically attach authorized security credentials."
                : "Engine calls are gated against unauthorized public bot traffic. Enter the secret access passcode to unlock the terminal."}
            </p>
          </div>

          <div>
            {passcode ? (
              <button
                onClick={handleRevokePasscode}
                className="hud-button hud-button-danger"
                style={{ fontSize: "0.75rem", minHeight: "38px" }}
              >
                REVOKE CLEARANCE
              </button>
            ) : (
              <form onSubmit={handleSavePasscode} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center", flex: "1 1 200px" }}>
                  <input
                    type={showPasscode ? "text" : "password"}
                    placeholder="Enter Access Passcode..."
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    className="hud-input"
                    style={{ paddingRight: "2.4rem", minHeight: "38px" }}
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
                  className="hud-button hud-button-primary"
                  style={{ fontSize: "0.75rem", minHeight: "38px", whiteSpace: "nowrap" }}
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

      {/* HUD Mode Navigation: New Intake vs Case History Archive */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setDashboardMode("intake")}
          className={`hud-button ${dashboardMode === "intake" ? "primary" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.55rem 1.1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: dashboardMode === "intake" ? "rgba(0, 240, 255, 0.15)" : "rgba(10, 17, 36, 0.6)",
            borderColor: dashboardMode === "intake" ? "var(--accent-cyan)" : "var(--border-subtle)",
            color: dashboardMode === "intake" ? "var(--accent-cyan)" : "var(--text-secondary)",
          }}
        >
          <span>➕ DECISION INTAKE CONSOLE</span>
        </button>

        <button
          onClick={() => {
            setDashboardMode("history");
            if (passcode) fetchSessions();
          }}
          className={`hud-button ${dashboardMode === "history" ? "primary" : ""}`}
          style={{
            fontSize: "0.82rem",
            padding: "0.55rem 1.1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: dashboardMode === "history" ? "rgba(0, 240, 255, 0.15)" : "rgba(10, 17, 36, 0.6)",
            borderColor: dashboardMode === "history" ? "var(--accent-cyan)" : "var(--border-subtle)",
            color: dashboardMode === "history" ? "var(--accent-cyan)" : "var(--text-secondary)",
          }}
        >
          <span>🗄️ CASE HISTORY ARCHIVE</span>
          <span
            style={{
              padding: "0.1rem 0.45rem",
              borderRadius: "9999px",
              fontSize: "0.7rem",
              backgroundColor: "rgba(0, 240, 255, 0.2)",
              color: "var(--accent-cyan)",
              border: "1px solid rgba(0, 240, 255, 0.4)",
            }}
          >
            {sessionsList.length}
          </span>
        </button>
      </div>

      {/* Case History Archive View */}
      {dashboardMode === "history" && (
        <section className="hud-card stagger-item">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <h2 className="font-display" style={{ fontSize: "1.2rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
                  PERSISTENT CASE HISTORY ARCHIVE
                </h2>
                <span className={`status-pill ${passcode ? "online" : "warning"}`}>
                  {passcode ? "AUTHORIZED" : "LOCKED"}
                </span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                Browse past decisions, decrypt raw narratives server-side on demand, and review historical 4-persona syntheses.
              </p>
            </div>
          </div>

          {!passcode ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.85rem 1.1rem",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px dashed rgba(245, 158, 11, 0.45)",
                borderRadius: "8px",
                color: "var(--accent-amber)",
                fontSize: "0.82rem",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span>🔒</span>
              <span>TERMINAL LOCKED — Enter your Security Clearance Passcode above to access archived decisions.</span>
            </div>
          ) : (
            <CaseHistoryDrawer
              sessions={sessionsList}
              loading={loadingSessions}
              isWaking={isWakingArchive}
              onSelectSession={handleReopenSession}
              onDeleteSession={handleDeleteSession}
              onRefresh={() => fetchSessions()}
              activeSessionId={activeSessionId}
            />
          )}
        </section>
      )}

      {/* Decision Intake Console */}
      {dashboardMode === "intake" && (
      <section className="hud-card stagger-item">
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleLoadSample}
              disabled={!passcode || analyzing}
              className="hud-button"
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", minHeight: "34px" }}
            >
              Load Sample Dilemma
            </button>
            <button
              onClick={handleClearForm}
              disabled={!passcode || analyzing}
              className="hud-button"
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", minHeight: "34px", color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}
            >
              Clear Fields
            </button>
          </div>
        </div>

        {!passcode && (
          <div
            style={{
              padding: "0.85rem 1.1rem",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px dashed rgba(245, 158, 11, 0.45)",
              borderRadius: "8px",
              marginBottom: "1.2rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🔒</span>
              <div>
                <div className="font-mono" style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--accent-amber)" }}>
                  TERMINAL LOCKED — SECURITY CLEARANCE REQUIRED
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  Please enter your passcode in the Security Clearance Gate above to unlock intake fields and execution controls.
                </div>
              </div>
            </div>
            <span className="status-pill warning" style={{ whiteSpace: "nowrap" }}>
              ENGINE CALLS GATED
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-cyan)" }}>
                CORE OBJECTIVES (PRIMARY OUTCOMES) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
              </label>
              <VoiceMicButton
                label="Core Objectives"
                disabled={!passcode || analyzing}
                onTranscript={(text) => setCoreObjectives((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter objectives..." : "State the explicit outcome or decision goal (e.g., PLG pivot vs enterprise enterprise sales)..."}
              value={coreObjectives}
              onChange={(e) => setCoreObjectives(e.target.value)}
              disabled={!passcode || analyzing}
              rows={2}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-blue)" }}>
                KNOWN CONSTRAINTS (RUNWAY, CAPITAL, TIMELINE, TEAMS) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
              </label>
              <VoiceMicButton
                label="Known Constraints"
                disabled={!passcode || analyzing}
                onTranscript={(text) => setKnownConstraints((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter constraints..." : "Runway, headcount, non-negotiable boundaries, cash constraints..."}
              value={knownConstraints}
              onChange={(e) => setKnownConstraints(e.target.value)}
              disabled={!passcode || analyzing}
              rows={2}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-indigo)" }}>
                RAW NARRATIVE (FULL SITUATIONAL CONTEXT & CONFLICTING SIGNALS) {!passcode && <span style={{ color: "var(--accent-amber)", fontSize: "0.72rem" }}>(LOCKED)</span>}
              </label>
              <VoiceMicButton
                label="Raw Narrative"
                disabled={!passcode || analyzing}
                onTranscript={(text) => setRawNarrative((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <textarea
              className="hud-textarea"
              placeholder={!passcode ? "[TERMINAL LOCKED] Authenticate via Security Clearance Gate above to enter narrative context..." : "Describe the full backstory, conflicting internal opinions, external risks, procurement delays, customer signals, and dilemma..."}
              value={rawNarrative}
              onChange={(e) => setRawNarrative(e.target.value)}
              disabled={!passcode || analyzing}
              rows={4}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                🛡️ App-layer AES-256-GCM encrypted before storage. Note: Avoid entering unhashed secrets, passwords, or personal identity numbers.
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {rawNarrative.length} / 5,000 chars
              </span>
            </div>
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
              className={`hud-button ${passcode && !analyzing ? "hud-button-primary" : ""}`}
              style={{
                padding: "0.85rem 1.85rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                minHeight: "46px",
                ...(!passcode ? { borderColor: "rgba(245, 158, 11, 0.4)", color: "var(--accent-amber)" } : {}),
              }}
            >
              {!passcode
                ? "🔒 CLEARANCE REQUIRED TO EXECUTE"
                : analyzing
                ? "COGNITIVE SYNTHESIS IN PROGRESS..."
                : "EXECUTE DECISION ANALYSIS [Ctrl+↵]"}
            </button>
          </div>
        </div>

        {/* Live Streaming Stage Indicator (Laser Progress Bar with Abort Action) */}
        {analyzing && (
          <div style={{ marginTop: "1.5rem", padding: "1.1rem", background: "rgba(0, 240, 255, 0.06)", border: "1px solid var(--accent-cyan)", borderRadius: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span className="pulse-dot cyan" />
                <span className="font-mono" style={{ color: "var(--accent-cyan)", fontSize: "0.85rem", fontWeight: 700 }}>
                  {analysisStage}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="status-pill cyan" style={{ fontSize: "0.68rem" }}>
                  ACTIVE REASONING
                </span>
                <button
                  type="button"
                  onClick={handleAbort}
                  className="hud-button hud-button-danger"
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.25rem 0.65rem",
                    minHeight: "30px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                  title="Abort in-flight reasoning (or press Esc)"
                >
                  <span>🛑</span>
                  <span>ABORT RUN [ESC]</span>
                </button>
              </div>
            </div>
            <div className="laser-progress-container">
              <div
                className="laser-progress-fill"
                style={{
                  transform: `scaleX(${
                    analysisStage.includes("Stage 1")
                      ? 0.25
                      : analysisStage.includes("Stage 2")
                      ? 0.5
                      : analysisStage.includes("Stage 3")
                      ? 0.75
                      : analysisStage.includes("Stage 4")
                      ? 0.95
                      : 0.15
                  })`,
                }}
              />
            </div>
          </div>
        )}
      </section>
      )}

      {/* Analysis Deliverables Panel (Rendered on Complete or Historic Inspection) */}
      {analysisResult && (
        <section className="hud-card stagger-item" id="deliverables-panel">
          {/* Historic Session Decrypted Banner (FR-15 & FR-17) */}
          {historicMetadata && (
            <div
              style={{
                marginBottom: "1.2rem",
                padding: "0.85rem 1.1rem",
                borderRadius: "8px",
                background: "rgba(0, 240, 255, 0.08)",
                border: "1px solid var(--accent-cyan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <span className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", fontWeight: 700 }}>
                  HISTORIC DOSSIER INSPECTION:
                </span>
                <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  ID: {historicMetadata.id.slice(0, 8)}...
                </span>
                <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  • Recorded: {new Date(historicMetadata.created_at).toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontFamily: "var(--font-mono)",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#34d399",
                  }}
                >
                  AES-256-GCM NARRATIVE DECRYPTED (FR-15 & FR-17)
                </span>
              </div>
              <button
                onClick={() => {
                  setHistoricMetadata(null);
                  setActiveSessionId(null);
                }}
                className="font-mono"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Dismiss Banner
              </button>
            </div>
          )}

          {/* Outcome Feedback Bar (Milestone N2 / FR-30) */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              marginBottom: "1.2rem",
              background: currentSessionOutcome
                ? currentSessionOutcome.status === "followed_path"
                  ? "rgba(16, 185, 129, 0.08)"
                  : currentSessionOutcome.status === "deviated"
                  ? "rgba(245, 158, 11, 0.08)"
                  : "rgba(59, 130, 246, 0.08)"
                : "rgba(15, 23, 42, 0.4)",
              border: `1px solid ${
                currentSessionOutcome
                  ? currentSessionOutcome.status === "followed_path"
                    ? "rgba(16, 185, 129, 0.3)"
                    : currentSessionOutcome.status === "deviated"
                    ? "rgba(245, 158, 11, 0.3)"
                    : "rgba(59, 130, 246, 0.3)"
                  : "rgba(255, 255, 255, 0.08)"
              }`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.85rem" }}>
                {currentSessionOutcome?.status === "followed_path"
                  ? "✓"
                  : currentSessionOutcome?.status === "deviated"
                  ? "⚡"
                  : currentSessionOutcome?.status === "still_deciding"
                  ? "⏳"
                  : "📝"}
              </span>
              <span className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                REAL-WORLD OUTCOME:
              </span>
              {currentSessionOutcome ? (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    fontWeight: 700,
                    backgroundColor:
                      currentSessionOutcome.status === "followed_path"
                        ? "rgba(16, 185, 129, 0.2)"
                        : currentSessionOutcome.status === "deviated"
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(59, 130, 246, 0.2)",
                    color:
                      currentSessionOutcome.status === "followed_path"
                        ? "#34d399"
                        : currentSessionOutcome.status === "deviated"
                        ? "#fbbf24"
                        : "#60a5fa",
                  }}
                >
                  {currentSessionOutcome.status.toUpperCase().replace("_", " ")}
                </span>
              ) : (
                <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Pending real-world execution feedback
                </span>
              )}

              {currentSessionOutcome?.narrative && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    marginLeft: "0.5rem",
                  }}
                >
                  &quot;{currentSessionOutcome.narrative}&quot;
                </span>
              )}
            </div>

            {activeSessionId && (
              <button
                onClick={() => {
                  setModalOutcomeStatus(currentSessionOutcome?.status || "followed_path");
                  setModalOutcomeNarrative(currentSessionOutcome?.narrative || "");
                  setIsOutcomeModalOpen(true);
                }}
                className="hud-button"
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", cursor: "pointer" }}
              >
                <span>{currentSessionOutcome ? "Edit Outcome" : "+ Record Outcome"}</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="font-display" style={{ fontSize: "1.3rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
                COGNITIVE SYNTHESIS DELIVERABLES
              </h2>
              <div className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                {historicMetadata ? (
                  <span>Historical Record Retrieved from Supabase • Model: {analysisResult.metadata.model}</span>
                ) : (
                  <span>Computed in {(analysisResult.metadata.totalDurationMs / 1000).toFixed(1)}s via {analysisResult.metadata.model}</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  const code = passcode || (typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "");
                  const paramId = activeSessionId ? `&id=${encodeURIComponent(activeSessionId)}` : "";
                  window.open(`/api/export?decrypt=true&passcode=${encodeURIComponent(code)}${paramId}`, "_blank");
                }}
                className="hud-button"
                style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                title="Export this complete decision dossier as JSON (FR-25)"
              >
                <span>💾 Export Dossier JSON</span>
              </button>
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
            <div className="persona-tab-content" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* O.D.I.N. Tactical Voice Readback Controller */}
              <VoiceReadbackController
                synthesis={analysisResult.judge.synthesis}
                nextActions={analysisResult.judge.next_3_actions}
              />

              {/* Recognized Recurring Pattern Note (Milestone 5.5 / v1.1 Recall) */}
              {analysisResult.judge.pattern_note && (
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    background: "rgba(99, 102, 241, 0.12)",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>🧠</span>
                  <div>
                    <div className="font-mono" style={{ fontSize: "0.78rem", color: "var(--accent-indigo)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "0.2rem" }}>
                      CROSS-SESSION PATTERN RECOGNIZED IN ARCHIVE (M5.5 RECALL)
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                      {analysisResult.judge.pattern_note}
                    </p>
                  </div>
                </div>
              )}

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
            <div className="persona-tab-content" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
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
            <div className="persona-tab-content" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
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
            <div className="persona-tab-content" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 className="font-display" style={{ fontSize: "1.05rem", color: "var(--accent-violet)", letterSpacing: "0.05em" }}>
                    COGNITIVE BIAS AUDIT & BLIND SPOTS
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                    {analysisResult.behaviorist.summary}
                  </p>
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
                  BEHAVIORAL AUDIT REASONING
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
        <section className="hud-card stagger-item">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <h2 className="font-display" style={{ fontSize: "1.1rem", color: "var(--accent-cyan)", letterSpacing: "0.06em" }}>
              SYSTEM DIAGNOSTICS
            </h2>
            <button
              onClick={fetchHealth}
              disabled={loadingHealth}
              className="hud-button"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", minHeight: "34px" }}
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
        <section className="hud-card stagger-item">
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

      {/* FR-27 Opportunistic Outcome Capture Prompt */}
      {opportunisticPrecedent && (
        <div className="hud-modal-backdrop">
          <div className="hud-modal-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.8rem" }}>
              <span style={{ fontSize: "1.3rem" }}>⚡</span>
              <h3 className="font-display" style={{ fontSize: "1.1rem", color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
                HISTORICAL PRECEDENT DETECTED
              </h3>
            </div>

            <div
              style={{
                backgroundColor: "rgba(10, 18, 42, 0.8)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "0.85rem",
                marginBottom: "1rem",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem", flexWrap: "wrap", gap: "0.3rem" }}>
                <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  SIMILAR PAST DECISION ({Math.round((opportunisticPrecedent.similarity || 0) * 100)}% MATCH):
                </span>
                <span className="status-pill cyan" style={{ fontSize: "0.68rem", padding: "0.1rem 0.45rem" }}>
                  {opportunisticPrecedent.date}
                </span>
              </div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45 }}>
                &quot;{opportunisticPrecedent.core_objectives}&quot;
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.55 }}>
              Before synthesizing your new dilemma, did you follow the path recommended in this earlier decision? Recording your result enriches the Judge&apos;s outcome-weighting memory.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
                <button
                  onClick={() => handleOpportunisticDecision("followed_path")}
                  className="hud-button hud-button-success"
                  style={{ minHeight: "44px" }}
                >
                  ✓ Followed
                </button>
                <button
                  onClick={() => handleOpportunisticDecision("deviated")}
                  className="hud-button hud-button-warning"
                  style={{ minHeight: "44px" }}
                >
                  ⚡ Deviated
                </button>
                <button
                  onClick={() => handleOpportunisticDecision("still_deciding")}
                  className="hud-button hud-button-primary"
                  style={{ minHeight: "44px" }}
                >
                  ⏳ Still Deciding
                </button>
              </div>

              <button
                onClick={() => handleOpportunisticDecision(undefined)}
                style={{
                  marginTop: "0.4rem",
                  padding: "0.6rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Skip for Now ✕ (Proceed directly to synthesis)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Outcome Modal (FR-30) */}
      {isOutcomeModalOpen && activeSessionId && (
        <div className="hud-modal-backdrop">
          <div className="hud-modal-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📝</span>
                <h3 className="font-display" style={{ fontSize: "1.05rem", color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
                  RECORD DECISION OUTCOME
                </h3>
              </div>
              <button
                onClick={() => setIsOutcomeModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModalOutcome} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="font-mono" style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", display: "block", marginBottom: "0.45rem", fontWeight: 700 }}>
                  EXECUTION STATUS (REQUIRED)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setModalOutcomeStatus("followed_path")}
                    className={`hud-button ${modalOutcomeStatus === "followed_path" ? "hud-button-success" : ""}`}
                    style={{ minHeight: "44px" }}
                  >
                    ✓ Followed
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOutcomeStatus("deviated")}
                    className={`hud-button ${modalOutcomeStatus === "deviated" ? "hud-button-warning" : ""}`}
                    style={{ minHeight: "44px" }}
                  >
                    ⚡ Deviated
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOutcomeStatus("still_deciding")}
                    className={`hud-button ${modalOutcomeStatus === "still_deciding" ? "hud-button-primary" : ""}`}
                    style={{ minHeight: "44px" }}
                  >
                    ⏳ Deciding
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <label className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                    REFLECTIVE NARRATIVE & LESSONS (OPTIONAL)
                  </label>
                  <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    🛡️ AES-256 Encrypted
                  </span>
                </div>
                <textarea
                  className="hud-textarea"
                  rows={4}
                  placeholder="What happened in reality? Did the strategic risks manifest? What would you do differently next time?"
                  value={modalOutcomeNarrative}
                  onChange={(e) => setModalOutcomeNarrative(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsOutcomeModalOpen(false)}
                  className="hud-button"
                  style={{ minHeight: "38px" }}
                  disabled={isSavingModalOutcome}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="hud-button hud-button-primary"
                  style={{ minHeight: "38px" }}
                  disabled={isSavingModalOutcome}
                >
                  {isSavingModalOutcome ? "Saving..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
