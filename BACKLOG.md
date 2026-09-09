# Backlog

This backlog tracks the development milestones for Phase 2 (JARVIS Interface & Knowledge Hub) and future roadmap items.

## Phase 1 — v0.2.2 Cloud MVP (Completed)

- [x] **Milestone 1:** Repo scaffold, Streamlit secrets configured, gitleaks pre-commit hook installed.
- [x] **Milestone 2:** Four-call sequential engine wired to Gemini Flash, model string in one config variable, structured-output mode enabled.
- [x] **Milestone 3:** Structured intake UI and progressive-disclosure status implemented.
- [x] **Milestone 4:** Multi-tab deliverable rendering built and verified on a phone browser.
- [x] **Milestone 5:** Security- and schema-verification pass completed before Phase 1 is declared done.

## Phase 2 — v1.2 JARVIS Interface & Knowledge Hub (Target: 4–6 weeks from build start)

*Note: All development must adhere to the "Vibe Coding" Execution Loop (Ingest Context -> Phase-Close Testing/TDD -> Execute -> Error Handling -> Document & Persist) from the Universal IT Project Development Protocol.*

### Must-Have
- [x] **M1:** Next.js scaffold deployed on Vercel free tier; environment variables (Gemini + Supabase keys) configured; gitleaks pre-commit hook carried over.
- [x] **M2:** Four-call sequential engine ported to Next.js API routes (Server-side only); Section 20 prompts and schemas copied verbatim; Gemini 3.5 Flash pinned.
- [x] **M2.5 (Access Control & Quota Protection):** Secret Access Passcode Gate implemented (`ODIN_ACCESS_PASSCODE`), HUD security clearance card wired, `/api/analyze` protected against unauthorized public quota drain (HTTP 401 on mismatch).
- [x] **M3:** Supabase schema (Postgres + pgvector) migration completed with Row-Level Security (RLS) policies blocking public access; app-layer AES-256-GCM encryption on `raw_narrative` implemented and verified round-trip; Gemini 768-dim vector embeddings of Judge syntheses enabled; session delete endpoint implemented per FR-21.
- [x] **M4:** Web Speech API voice I/O wired to the intake flow (`useSpeechRecognition`, `VoiceMicButton`) and Judge report readback (`useSpeechSynthesis`, `VoiceReadbackController`); progressive status strings enforced; typed-field fallback verified (FR-13, FR-14).
- [x] **M5:** JARVIS-aesthetic UI build (`CaseHistoryDrawer`, past session re-opening with server-side narrative decryption [FR-15], in-UI hard deletion [FR-21], progressive-disclosure status strings including Supabase auto-pause waking handling [PRD §21.2]).
- [x] **M5.5 (v1.1):** Cross-session recall built (embedding-then-similarity-query); Judge prompt amended; JSON export endpoint implemented.
- [x] **M6:** Security- and schema-verification pass; Streamlit app retired (hard cutover); $0 spend confirmed.
- [ ] **N1 (v1.2 Addendum):** `session_outcomes` schema migrated with RLS and app-layer encryption on narrative.
- [ ] **N2 (v1.2 Addendum):** Opportunistic prompt wired into new-session flow; manual outcome entry/edit added to detail view.
- [ ] **N3 (v1.2 Addendum):** Judge retrieval payload extended with outcome status/narrative_summary; Judge prompt amended.
- [ ] **N4 (v1.2 Addendum):** Section 14 QA extended to cover outcome flow end-to-end; $0 spend re-confirmed.

### Should-Have
- [x] Content-hygiene nudge (soft reminder in intake console).
- [x] Graceful handling of Supabase's free-tier auto-pause ("reconnecting" / "Waking the archive…" state).
- [x] Graceful voice-unavailable fallback (typed-field flow).
- [x] Session delete/purge capability (FR-21 in-UI hard deletion).

### Won't-Have (Deferred to Phase 3 or Rejected)
- [ ] Gemini Live API (rejected due to cost).
- [ ] Chroma Cloud (rejected due to cost).
- [ ] Stateful LangGraph multi-turn loop.
- [ ] Paid tiers anywhere in the stack.
- [ ] Parallel-running the old Streamlit app.

## Future-Readiness (Phase 3+)
- [ ] **Phase 3 — v2.0 Autonomous Agentic State Machine:** LangGraph rebuild, Python interpreter tool, and subagent topology. (Trigger: Phase 2 stable, genuine need for standing autonomous agent that can act on the user's behalf).
