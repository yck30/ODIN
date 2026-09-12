"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export interface SessionSummary {
  id: string;
  created_at: string;
  core_objectives: string;
  recommended_path: string;
  outcome_status?: "followed_path" | "deviated" | "still_deciding" | null;
}

interface CaseHistoryDrawerProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onRefresh: () => void;
  onDeleteSession: (id: string) => Promise<void>;
  loading?: boolean;
  isWaking?: boolean;
}

export default function CaseHistoryDrawer({
  sessions,
  activeSessionId,
  onSelectSession,
  onRefresh,
  onDeleteSession,
  loading = false,
  isWaking = false,
}: CaseHistoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Manual Outcome Editor Modal State (FR-30)
  const [editingOutcomeSession, setEditingOutcomeSession] = useState<SessionSummary | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<"followed_path" | "deviated" | "still_deciding">("followed_path");
  const [outcomeNarrative, setOutcomeNarrative] = useState("");
  const [loadingOutcomeDetails, setLoadingOutcomeDetails] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.core_objectives.toLowerCase().includes(q) ||
      s.recommended_path.toLowerCase().includes(q) ||
      (s.outcome_status && s.outcome_status.toLowerCase().includes(q)) ||
      new Date(s.created_at).toLocaleDateString().includes(q)
    );
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDeleteSession(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleOpenOutcomeEditor = async (session: SessionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOutcomeSession(session);
    setOutcomeStatus(session.outcome_status || "followed_path");
    setOutcomeNarrative("");
    setOutcomeError(null);
    setLoadingOutcomeDetails(true);

    try {
      const passcode = typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "";
      const headers: Record<string, string> = {};
      if (passcode) headers["x-odin-access-passcode"] = passcode;

      const res = await fetch(`/api/sessions/${session.id}/outcomes`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.outcome) {
          setOutcomeStatus(data.outcome.status || "followed_path");
          setOutcomeNarrative(data.outcome.narrative || "");
        }
      }
    } catch (err) {
      console.warn("Could not load existing outcome narrative:", err);
    } finally {
      setLoadingOutcomeDetails(false);
    }
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutcomeSession) return;

    setSavingOutcome(true);
    setOutcomeError(null);

    try {
      const passcode = typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "";
      const res = await fetch(`/api/sessions/${editingOutcomeSession.id}/outcomes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-odin-access-passcode": passcode,
        },
        body: JSON.stringify({
          status: outcomeStatus,
          narrative: outcomeNarrative.trim(),
          prompted_via: "manual",
          passcode,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save outcome.");
      }

      setEditingOutcomeSession(null);
      onRefresh();
    } catch (err) {
      setOutcomeError(err instanceof Error ? err.message : "Failed to record outcome.");
    } finally {
      setSavingOutcome(false);
    }
  };

  return (
    <div className="hud-drawer-container">
      {/* Search & Utility Toolbar */}
      <div className="hud-search-bar">
        <div className="hud-search-input-group">
          <span style={{ fontSize: "0.9rem" }}>🔍</span>
          <input
            type="text"
            placeholder="Search cases by objective, verdict, outcome, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="hud-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "0.85rem",
                padding: "0 0.3rem",
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            {filteredSessions.length} {filteredSessions.length === 1 ? "Case" : "Cases"}
          </span>

          <button
            onClick={() => {
              const code = typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "";
              if (!code) return;
              window.open(`/api/export?decrypt=true&passcode=${encodeURIComponent(code)}`, "_blank");
            }}
            disabled={loading || filteredSessions.length === 0}
            className="hud-button"
            style={{ fontSize: "0.72rem", padding: "0.3rem 0.65rem", minHeight: "34px" }}
            title="Export all archived sessions as portable human-readable JSON (FR-25 & FR-31)"
          >
            <svg style={{ width: "13px", height: "13px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export Decrypted</span>
          </button>

          <button
            onClick={() => {
              const code = typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "";
              if (!code) return;
              window.open(`/api/export?passcode=${encodeURIComponent(code)}`, "_blank");
            }}
            disabled={loading || filteredSessions.length === 0}
            className="hud-button"
            style={{ fontSize: "0.72rem", padding: "0.3rem 0.65rem", minHeight: "34px", color: "var(--text-secondary)" }}
            title="Export all sessions with narrative encrypted (Safe Backup)"
          >
            <svg style={{ width: "13px", height: "13px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Backup Ciphertext</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="hud-button"
            style={{ minHeight: "34px", padding: "0.3rem 0.6rem" }}
            title="Refresh Archive"
          >
            <svg
              style={{
                width: "14px",
                height: "14px",
                animation: loading ? "pulseGlow 1s linear infinite" : "none",
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Supabase Free-Tier Cold-Start Waking Alert (PRD §21.2) */}
      {isWaking && (
        <div
          className="hud-card"
          style={{
            borderColor: "var(--accent-amber)",
            background: "rgba(245, 158, 11, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.85rem 1.15rem",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>⏳</span>
          <div style={{ flex: 1 }}>
            <span className="font-mono" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-amber)" }}>
              Waking the archive…
            </span>
            <p className="font-mono" style={{ fontSize: "0.72rem", color: "rgba(245, 158, 11, 0.85)", marginTop: "0.2rem" }}>
              Supabase free-tier database is spinning up after inactivity. Case dossiers will load momentarily.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !isWaking && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "2rem 0", alignItems: "center", justifyContent: "center" }}>
          <div className="pulse-dot cyan" style={{ width: "12px", height: "12px" }} />
          <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Scanning persistent case records…
          </span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSessions.length === 0 && (
        <div
          className="hud-card"
          style={{
            borderStyle: "dashed",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "1.8rem", display: "block", marginBottom: "0.5rem" }}>📂</span>
          <p className="font-mono" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
            {searchTerm ? "No archived decisions match your query." : "No decision cases stored yet."}
          </p>
          <p className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
            {searchTerm ? "Try searching by another keyword or clear the search filter." : "Synthesize a decision in the intake console to establish your first persistent case record."}
          </p>
        </div>
      )}

      {/* Session Dossier Cards List */}
      {!loading && filteredSessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filteredSessions.map((session) => {
            const isSelected = activeSessionId === session.id;
            const isDeleting = deletingId === session.id;
            const isConfirming = confirmDeleteId === session.id;
            const formattedDate = new Date(session.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <div
                key={session.id}
                className={`hud-dossier-card ${isSelected ? "active" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                      <span className="status-pill cyan" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                        {formattedDate}
                      </span>
                      {isSelected && (
                        <span className="status-pill online" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                          ACTIVE INSPECTION
                        </span>
                      )}

                      {/* Outcome Status Badges */}
                      {session.outcome_status === "followed_path" && (
                        <span className="status-pill online" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                          ✓ FOLLOWED PATH
                        </span>
                      )}
                      {session.outcome_status === "deviated" && (
                        <span className="status-pill warning" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                          ⚡ DEVIATED
                        </span>
                      )}
                      {session.outcome_status === "still_deciding" && (
                        <span className="status-pill cyan" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                          ⏳ STILL DECIDING
                        </span>
                      )}
                      {!session.outcome_status && (
                        <button
                          onClick={(e) => handleOpenOutcomeEditor(session, e)}
                          className="hud-button"
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.15rem 0.5rem",
                            minHeight: "26px",
                            borderStyle: "dashed",
                          }}
                          title="Record what actually happened after this decision (FR-30)"
                        >
                          + LOG OUTCOME
                        </button>
                      )}

                      <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        ID: {session.id.slice(0, 8)}...
                      </span>
                    </div>

                    <h4 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.45rem", lineHeight: 1.4 }}>
                      {session.core_objectives}
                    </h4>

                    {/* Recommended Verdict Snippet */}
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-cyan)",
                        background: "rgba(0, 240, 255, 0.05)",
                        border: "1px solid rgba(0, 240, 255, 0.2)",
                        padding: "0.45rem 0.75rem",
                        borderRadius: "6px",
                        display: "flex",
                        gap: "0.4rem",
                      }}
                    >
                      <strong style={{ color: "var(--accent-cyan)" }}>VERDICT:</strong>
                      <span style={{ fontStyle: "italic", color: "var(--text-primary)" }}>&quot;{session.recommended_path}&quot;</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`hud-button ${isSelected ? "hud-button-primary" : ""}`}
                      style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem", minHeight: "34px" }}
                    >
                      <svg style={{ width: "13px", height: "13px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{isSelected ? "Inspecting" : "Re-Open"}</span>
                    </button>

                    {/* Manage Outcome Button (FR-30) */}
                    <button
                      onClick={(e) => handleOpenOutcomeEditor(session, e)}
                      className="hud-button"
                      style={{ fontSize: "0.72rem", padding: "0.4rem 0.65rem", minHeight: "34px", color: "var(--text-secondary)" }}
                    >
                      <span>📝</span>
                      <span>{session.outcome_status ? "Edit Outcome" : "Log Outcome"}</span>
                    </button>

                    {isConfirming ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          disabled={isDeleting}
                          className="hud-button hud-button-danger"
                          style={{ fontSize: "0.72rem", padding: "0.35rem 0.65rem", minHeight: "34px" }}
                        >
                          {isDeleting ? "Purging…" : "Confirm Delete"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="hud-button"
                          style={{ fontSize: "0.72rem", padding: "0.35rem 0.5rem", minHeight: "34px", color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(session.id);
                        }}
                        aria-label="Delete past session"
                        title="Purge session permanently from Supabase (FR-21)"
                        className="hud-button"
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.35rem 0.6rem",
                          minHeight: "34px",
                          color: "var(--text-muted)",
                          borderColor: "transparent",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Outcome Modal (FR-30) Rendered via Portal directly into document.body to avoid parent card clipping */}
      {mounted && editingOutcomeSession && typeof document !== "undefined" && createPortal(
        <div
          className="hud-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingOutcomeSession(null);
          }}
        >
          <div className="hud-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📝</span>
                <h3 className="font-display" style={{ fontSize: "1.05rem", color: "var(--accent-cyan)", letterSpacing: "0.05em" }}>
                  {editingOutcomeSession.outcome_status ? "EDIT DECISION OUTCOME" : "RECORD DECISION OUTCOME"}
                </h3>
              </div>
              <button
                onClick={() => setEditingOutcomeSession(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                background: "rgba(10, 18, 42, 0.8)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
                <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  DECISION OBJECTIVE:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const id = editingOutcomeSession.id;
                    setEditingOutcomeSession(null);
                    onSelectSession(id);
                  }}
                  className="hud-button"
                  style={{
                    fontSize: "0.68rem",
                    padding: "0.15rem 0.45rem",
                    minHeight: "24px",
                    borderColor: "var(--border-subtle)",
                    color: "var(--accent-cyan)",
                  }}
                  title="Open full mathematical and strategic arbitration dossier in HUD inspection console"
                >
                  Inspect Full Case Dossier ↗
                </button>
              </div>
              <div
                style={{
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  maxHeight: "100px",
                  overflowY: "auto",
                  lineHeight: 1.45,
                  paddingRight: "0.3rem",
                }}
              >
                {editingOutcomeSession.core_objectives}
              </div>

              {editingOutcomeSession.recommended_path && (
                <div style={{ marginTop: "0.2rem", paddingTop: "0.4rem", borderTop: "1px dashed var(--border-subtle)" }}>
                  <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", display: "block", marginBottom: "0.15rem" }}>
                    RECOMMENDED VERDICT:
                  </span>
                  <div style={{ color: "var(--text-secondary)", fontStyle: "italic", maxHeight: "80px", overflowY: "auto", lineHeight: 1.4 }}>
                    &quot;{editingOutcomeSession.recommended_path}&quot;
                  </div>
                </div>
              )}
            </div>

            {loadingOutcomeDetails ? (
              <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.8rem" }} className="font-mono">
                Decrypting existing outcome details...
              </div>
            ) : (
              <form onSubmit={handleSaveOutcome} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="font-mono" style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", display: "block", marginBottom: "0.4rem", fontWeight: 700 }}>
                    EXECUTION STATUS (REQUIRED)
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("followed_path")}
                      className={`hud-button ${outcomeStatus === "followed_path" ? "hud-button-success" : ""}`}
                      style={{ fontSize: "0.75rem", minHeight: "42px" }}
                    >
                      ✓ Followed Path
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("deviated")}
                      className={`hud-button ${outcomeStatus === "deviated" ? "hud-button-warning" : ""}`}
                      style={{ fontSize: "0.75rem", minHeight: "42px" }}
                    >
                      ⚡ Deviated
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("still_deciding")}
                      className={`hud-button ${outcomeStatus === "still_deciding" ? "hud-button-primary" : ""}`}
                      style={{ fontSize: "0.75rem", minHeight: "42px" }}
                    >
                      ⏳ Still Deciding
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <label className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                      REFLECTION NARRATIVE (OPTIONAL)
                    </label>
                    <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>🛡️ AES-256 Encrypted</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="What actually occurred? Did the strategy yield expected outcomes, or were there unforeseen roadblocks?"
                    value={outcomeNarrative}
                    onChange={(e) => setOutcomeNarrative(e.target.value)}
                    className="hud-textarea"
                  />
                </div>

                {outcomeError && (
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "0.75rem",
                      color: "#fda4af",
                      background: "rgba(244, 63, 94, 0.12)",
                      border: "1px solid var(--accent-rose)",
                      borderRadius: "6px",
                      padding: "0.6rem 0.8rem",
                    }}
                  >
                    {outcomeError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <button
                    type="button"
                    onClick={() => setEditingOutcomeSession(null)}
                    disabled={savingOutcome}
                    className="hud-button"
                    style={{ minHeight: "38px" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOutcome}
                    className="hud-button hud-button-primary"
                    style={{ minHeight: "38px" }}
                  >
                    {savingOutcome ? "Encrypting & Storing…" : "Save Outcome"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
