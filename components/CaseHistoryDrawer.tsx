"use client";

import React, { useState } from "react";

export interface SessionSummary {
  id: string;
  created_at: string;
  core_objectives: string;
  known_constraints?: string;
  recommended_path: string;
  outcome_status?: "followed_path" | "deviated" | "still_deciding" | null;
  prompted_via?: "opportunistic" | "manual" | null;
}

interface CaseHistoryDrawerProps {
  sessions: SessionSummary[];
  loading: boolean;
  isWaking: boolean;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<void>;
  onRefresh: () => void;
  activeSessionId?: string | null;
}

export default function CaseHistoryDrawer({
  sessions,
  loading,
  isWaking,
  onSelectSession,
  onDeleteSession,
  onRefresh,
  activeSessionId,
}: CaseHistoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Outcome edit state (FR-30)
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
    <div className="flex flex-col gap-4">
      {/* Search & Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="text-slate-500 text-sm font-mono">🔍</span>
          <input
            type="text"
            placeholder="Search past cases by objective, verdict, outcome, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-slate-500 hover:text-slate-300 text-xs font-mono px-1.5"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            {filteredSessions.length} {filteredSessions.length === 1 ? "Case" : "Cases"} Archived
          </span>

          <button
            onClick={() => {
              const code = typeof window !== "undefined" ? localStorage.getItem("odin_passcode") || "" : "";
              if (!code) return;
              window.open(`/api/export?decrypt=true&passcode=${encodeURIComponent(code)}`, "_blank");
            }}
            disabled={loading || filteredSessions.length === 0}
            className="px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-700 hover:border-cyan-500/80 text-cyan-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export all archived sessions as portable human-readable JSON (FR-25 & FR-31)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-400 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export all sessions with narrative encrypted (Safe Backup)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Backup Ciphertext</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-xs font-mono rounded bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Archive"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`}
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
        <div className="flex items-center gap-3 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-mono animate-pulse">
          <span className="text-base">⏳</span>
          <div className="flex-1">
            <span className="font-bold">Waking the archive…</span>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              Supabase free-tier database is spinning up after inactivity. Case dossiers will load momentarily.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !isWaking && (
        <div className="flex flex-col gap-3 py-6 items-center justify-center text-slate-500 font-mono text-xs">
          <div className="w-6 h-6 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
          <span>Scanning persistent case records…</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSessions.length === 0 && (
        <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center font-mono">
          <span className="text-2xl mb-2 block">📂</span>
          <p className="text-slate-400 text-xs font-semibold">
            {searchTerm ? "No archived decisions match your query." : "No decision cases stored yet."}
          </p>
          <p className="text-slate-600 text-[11px] mt-1">
            {searchTerm ? "Try searching by another keyword or clear the search filter." : "Synthesize a decision in the intake console to establish your first persistent case record."}
          </p>
        </div>
      )}

      {/* Session Cards List */}
      {!loading && filteredSessions.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
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
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? "bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_16px_rgba(6,182,212,0.2)]"
                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                        {formattedDate}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/60 border border-cyan-500/50 px-2 py-0.5 rounded animate-pulse">
                          ACTIVE INSPECTION
                        </span>
                      )}

                      {/* Outcome Status Badge (FR-28, FR-30) */}
                      {session.outcome_status === "followed_path" && (
                        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <span>✓</span> FOLLOWED PATH
                        </span>
                      )}
                      {session.outcome_status === "deviated" && (
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <span>⚡</span> DEVIATED
                        </span>
                      )}
                      {session.outcome_status === "still_deciding" && (
                        <span className="text-[10px] font-mono text-blue-300 bg-blue-950/60 border border-blue-500/50 px-2 py-0.5 rounded flex items-center gap-1">
                          <span>⏳</span> STILL DECIDING
                        </span>
                      )}
                      {!session.outcome_status && (
                        <button
                          onClick={(e) => handleOpenOutcomeEditor(session, e)}
                          className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 bg-slate-800/60 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-cyan-500/50 px-2 py-0.5 rounded transition-all cursor-pointer"
                          title="Record what actually happened after this decision (FR-30)"
                        >
                          + LOG OUTCOME
                        </button>
                      )}

                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                        ID: {session.id.slice(0, 8)}...
                      </span>
                    </div>

                    <h4 className="font-semibold text-sm text-slate-200 line-clamp-2 mb-1.5">
                      {session.core_objectives}
                    </h4>

                    {/* Recommended Verdict Snippet */}
                    <div className="flex items-start gap-1.5 text-xs font-mono text-cyan-300/90 bg-cyan-950/30 border border-cyan-500/20 px-2.5 py-1.5 rounded-lg">
                      <span className="text-cyan-400 font-bold shrink-0">VERDICT:</span>
                      <span className="italic line-clamp-2">&quot;{session.recommended_path}&quot;</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg border transition-all duration-150 flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                          : "bg-cyan-950/60 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/80 hover:border-cyan-400"
                      } active:scale-95 cursor-pointer`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{isSelected ? "Inspecting" : "Re-Open"}</span>
                    </button>

                    {/* Manage Outcome Button (FR-30) */}
                    <button
                      onClick={(e) => handleOpenOutcomeEditor(session, e)}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>📝</span>
                      <span>{session.outcome_status ? "Edit Outcome" : "Log Outcome"}</span>
                    </button>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-[11px] font-mono bg-red-900/80 text-red-200 border border-red-600 rounded hover:bg-red-800 active:scale-95 cursor-pointer"
                        >
                          {isDeleting ? "Purging…" : "Confirm Hard Delete"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
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
                        className="px-2 py-1 text-[11px] font-mono text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded border border-transparent hover:border-red-900/50 transition-all cursor-pointer"
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

      {/* Manual Outcome Modal (FR-30) */}
      {editingOutcomeSession && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-5 shadow-[0_0_30px_rgba(6,182,212,0.2)] font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400">📝</span>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  {editingOutcomeSession.outcome_status ? "Edit Decision Outcome" : "Record Decision Outcome"}
                </h3>
              </div>
              <button
                onClick={() => setEditingOutcomeSession(null)}
                className="text-slate-500 hover:text-slate-300 text-sm px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400 mb-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase">Decision Objective:</span>
              <span className="text-slate-200 font-semibold">{editingOutcomeSession.core_objectives}</span>
            </div>

            {loadingOutcomeDetails ? (
              <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                Decrypting existing outcome details...
              </div>
            ) : (
              <form onSubmit={handleSaveOutcome} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11px] text-cyan-300 uppercase tracking-wider mb-1.5 font-bold">
                    Execution Status (Required)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("followed_path")}
                      className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        outcomeStatus === "followed_path"
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      ✓ Followed Path
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("deviated")}
                      className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        outcomeStatus === "deviated"
                          ? "bg-amber-950/80 border-amber-500 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      ⚡ Deviated
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutcomeStatus("still_deciding")}
                      className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        outcomeStatus === "still_deciding"
                          ? "bg-blue-950/80 border-blue-500 text-blue-300 font-bold shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      ⏳ Still Deciding
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 uppercase tracking-wider">
                      Reflection Narrative (Optional)
                    </label>
                    <span className="text-[10px] text-slate-500">🛡️ AES-256 Encrypted</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="What actually occurred? Did the recommended strategy yield expected results, or were there unforeseen surprises?"
                    value={outcomeNarrative}
                    onChange={(e) => setOutcomeNarrative(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/80 font-mono"
                  />
                </div>

                {outcomeError && (
                  <div className="p-2.5 rounded bg-rose-950/50 border border-rose-600/50 text-rose-300 text-xs">
                    {outcomeError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingOutcomeSession(null)}
                    disabled={savingOutcome}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOutcome}
                    className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer disabled:opacity-50"
                  >
                    {savingOutcome ? "Encrypting & Storing…" : "Save Outcome"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
