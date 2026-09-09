"use client";

import React, { useState } from "react";

export interface SessionSummary {
  id: string;
  created_at: string;
  core_objectives: string;
  known_constraints?: string;
  recommended_path: string;
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

  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.core_objectives.toLowerCase().includes(q) ||
      s.recommended_path.toLowerCase().includes(q) ||
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

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="text-slate-500 text-sm font-mono">🔍</span>
          <input
            type="text"
            placeholder="Search past cases by objective, verdict, or date..."
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
            title="Export all archived sessions as portable JSON (FR-25)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export JSON</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh case history archive"
            className="p-1.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-300 transition-all text-xs font-mono disabled:opacity-50 cursor-pointer"
            title="Refresh memory archive"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading / Waking state per PRD §21.2 */}
      {loading && (
        <div className="p-8 text-center bg-slate-950/40 border border-cyan-500/20 rounded-xl">
          <div className="inline-flex items-center gap-2 text-cyan-400 font-mono text-xs animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            {isWaking ? "Waking the archive…" : "Retrieving decision records from Supabase…"}
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            Re-establishing connection with persistent vector memory cluster.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <div className="p-10 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
          <div className="text-2xl mb-2">🗄️</div>
          <div className="font-mono text-xs font-semibold text-slate-300 tracking-wide">
            ARCHIVE IS CURRENTLY EMPTY
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1 max-w-md mx-auto">
            No past decisions recorded yet. Submit your first dilemma via the Intake Console to create an encrypted, persistent entry.
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
                        className="p-1.5 text-xs font-mono text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-red-950/30"
                        title="Permanently delete session (FR-21)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
