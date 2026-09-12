# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Outcome Modal Viewport Isolation & Container Clipping Elimination (React Portals)**:
  - Fixed modal backdrop and dialog being trapped inside `.hud-card` parent containers by leveraging React Portals (`createPortal(..., document.body)`). Previously, `.hud-card`'s `overflow: hidden` and CSS `animation: fadeInUp` established a local containing block per the CSS spec, forcing `position: fixed` modals to be clipped inside the card boundaries (~400px height) rather than covering the browser viewport.
  - Portaled all modals (`editingOutcomeSession` in `components/CaseHistoryDrawer.tsx`, and `opportunisticPrecedent` + `isOutcomeModalOpen` in `app/page.tsx`) directly into `document.body` with `z-index: 99999` and `margin: auto; flex-shrink: 0`, guaranteeing full unclipped visibility of headers, objectives, status buttons, textareas, and action buttons.
- **Persona Header Word & Box Boundary Collision Prevention**:
  - Eliminated word collisions between summary narratives and status pills (e.g. `... across three competing Confidence: high`) by restructuring persona headers into a dedicated title-and-badge row (`justify-content: space-between; gap: 1rem; flex-wrap: wrap;`) with full-width summary text underneath.
  - Added global `flex-shrink: 0` to `.status-pill` in `app/globals.css` ensuring telemetry badges never compress or collide with neighboring text.
  - Added explicit flex wrapping, line-height breathing room, and boundary gaps across Quant paths, Strategist reversibility moves, Behaviorist bias items, and Voice Readback banners.
- **Outcome Modal & Log Details Scrolling & Inspection**:
  - Fixed `.hud-modal-card` overflow clipping by replacing `overflow: hidden` with `overflow-y: auto`, `max-height: calc(100vh - 2.5rem)`, and sleek custom scrollbars, preventing modal buttons and reflection inputs from being clipped on compact viewports.
  - Added scrollable objective and verdict containers (`overflowY: auto`) inside outcome logging modals in `components/CaseHistoryDrawer.tsx` and `app/page.tsx`.
  - Added 1-tap "Inspect Full Case Dossier ↗" link inside the modal so users can view the full 4-persona synthesis details before recording execution outcomes.
- **Gemini Free-Tier Rate Limit Resilience & High-Throughput Failover**:
  - Resolved Google AI Studio free-tier 20 requests/day quota exhaustion by adopting `gemini-3.5-flash-lite` as the standard high-throughput engine model.
  - Implemented automatic on-the-fly model failover in `lib/engine/orchestrator.ts`: automatically falls back from `gemini-3.6-flash` to `gemini-3.5-flash-lite` upon encountering 429 / quota limits.
  - Replaced aggressive 12s failure abort with paced live status countdown updates via SSE (`"Rate-limit pacing active: Auto-resuming in Xs..."`) up to 65 seconds.
  - Added 1-second inter-stage cognitive pacing buffer to prevent free-tier burst RPM limits.
  - Dynamicized UI model status indicators in `app/page.tsx` and updated environment diagnostics in `lib/env.ts`.
- **Vercel Serverless Latency Optimization & Rate Limit Protection**:
  - Removed artificial 2-second sleep delays (`await sleep(2000)`) between personas in `lib/engine/orchestrator.ts`, cutting 6 seconds of dead serverless runtime.
  - Increased `maxDuration` to 300 in `app/api/analyze/route.ts` to allow up to 5 minutes on Vercel Pro accounts while staying within Hobby limits.
  - Dispatched `complete` deliverables immediately upon Judge completion without waiting for Supabase encryption and pgvector embedding, streaming deliverables instantly and updating `sessionId` via `persisted` event.
  - Initiated memory recall (`findSimilarPastDecisions`) concurrently with earlier persona executions, saving 2–4s upfront.
  - Added smart Google API rate-limit delay extraction in `callGeminiWithRetry` with fail-fast protections if retry delay exceeds serverless execution thresholds.
- **Vercel Engine Synthesis Deliverables Streaming & Display**:
  - Fixed client-side Server-Sent Events (SSE) reader bug in `app/page.tsx` where `currentEvent` was initialized inside the `while` loop, causing multi-chunk `complete` events to lose event context and silently drop the final Judge synthesis deliverables.
  - Added stream buffer flush (`decoder.decode()`) on reader completion and actionable error notification if a stream disconnects prematurely.
  - Added `"X-Accel-Buffering": "no"` to `app/api/analyze/route.ts` to prevent edge proxies from buffering SSE chunks.
  - Added a 5-second `Promise.race` safety timeout to `persistSessionIfConfigured` in `app/api/analyze/route.ts` to guarantee database latency never blocks the client from receiving the arbitration deliverables.
  - Added defensive array handling on Judge action and tension point lists to prevent UI render exceptions on schema edge cases.

### Added
- **Phase 2 Addendum Milestone N4 (N4) — Section 14 End-to-End QA Suite & $0 Cost Confirmation**:
  - Implemented comprehensive automated test suite (`scripts/test-outcomes-qa.ts`) verifying all 5 Section 14 QA gates:
    1. 4-path outcome recording test (`FOLLOWED_RECOMMENDATION`, `DEVIATED_FROM_RECOMMENDATION`, `STILL_DECIDING`, `CANCELLED_OR_SUPERSEDED`).
    2. Zero-plaintext leakage audit in Supabase (raw database query verifies `narrative_encrypted` contains solely AES-256-GCM ciphertext).
    3. Judge prompt outcome weighting integration test (verifies Judge receives outcome status and narrative summary and weighs historical success vs deviation).
    4. Data export completeness test (validates both ciphertext privacy and decrypted portability via `x-odin-access-passcode`).
    5. Cascading deletion test (`ON DELETE CASCADE` purges child outcome record upon session deletion).
  - Re-confirmed $0 cost ceiling across all infrastructure (Gemini Flash free tier, Supabase free Postgres + pgvector, Vercel serverless, Web Speech API).
- **Phase 2 Addendum Milestone N3 (N3) — Judge Semantic Retrieval Extension & Outcome-Aware Prompts**:
  - Extended semantic retrieval pipeline (`lib/recall.ts`, `lib/engine/types.ts`) to query `session_outcomes` for matched past sessions and decrypt narratives server-side into `PastContextOutcome`.
  - Amended `JUDGE_SYSTEM_PROMPT` and `formatJudgePrompt` (`lib/engine/prompts.ts`) per PRD v1.2 §20.7 with outcome-weighting directives (positive reinforcement for followed outcomes, pivot guidance and hazard warnings for deviated/adverse outcomes).
  - Maintained persona blindness boundaries: The Quant, The Strategist, and The Behaviorist remain strictly unaware of past sessions or outcomes.
  - Extended JSON export endpoint (`app/api/export/route.ts`) to join `session_outcomes` into exports per FR-31 (ciphertext by default, decrypted on demand with passcode).
- **Phase 2 Addendum Milestone N2 (N2) — Opportunistic Outcome Capture & Manual Outcome Management UI**:
  - Implemented opportunistic 1-tap outcome capture modal (`app/page.tsx`, FR-27) triggering prior to new session analysis when a high-similarity precedent (>= 0.65) lacks an outcome.
  - Built pre-check API endpoint (`app/api/recall/check/route.ts`) to query past sessions without running redundant full intake.
  - Built outcomes CRUD API route (`app/api/sessions/[id]/outcomes/route.ts`) with passcode protection, server-side AES-256-GCM encryption, and upsert handling.
  - Added visual outcome badges (`✓ FOLLOWED PATH`, `⚡ DEVIATED`, `⏳ STILL DECIDING`, `+ LOG OUTCOME`) in `components/CaseHistoryDrawer.tsx`.
  - Built manual outcome modal for logging/updating outcomes on historical sessions (FR-30) accessible from both `CaseHistoryDrawer` and the HUD deliverables panel.
- **Phase 2 Addendum Milestone N1 (N1) — Database Schema Migration with RLS & App-Layer Encryption**:
  - Created migration `scripts/migrations/02_create_session_outcomes.sql` defining `session_outcomes` table with 1-to-1 foreign key referencing `sessions(id)` and `ON DELETE CASCADE`.
  - Enforced Row-Level Security (RLS) policies completely blocking public/anonymous REST access to outcomes.
  - Implemented application-layer AES-256-GCM authenticated encryption for sensitive outcome narratives (`narrative_encrypted`).
  - Created verification test script `scripts/test-outcomes.ts` validating RLS denial, round-trip encryption/decryption, and cascade deletion.
- **Phase 2 Milestone 6 (M6) — Final Security QA, Hard Cutover & Streamlit Retirement**:
  - Archived legacy Phase 1 Streamlit application via annotated Git tag `phase-1-archive`.
  - Retired and purged deprecated Python Streamlit files (`src/`, `.streamlit/`, `list_models.py`, `requirements.txt`), completing the hard cutover to pure Next.js 15 App Router.
  - Performed comprehensive security verification pass: audited `.gitignore` to guarantee zero secret leakage (`.env*.local`, `secrets.toml`), verified `gitleaks` pre-commit configuration, and re-verified Supabase Row-Level Security (RLS).
  - Confirmed $0 spend ceiling across the entire architecture (Google Gemini Flash free tier, Supabase free Postgres + pgvector tier, Vercel Hobby serverless tier, and browser-native Web Speech API).
- **Phase 2 Milestone 5.5 (M5.5) — Cross-Session Semantic Recall & Data Portability**:
  - Built semantic vector similarity recall pipeline (`lib/recall.ts`, `match_past_sessions` RPC) executing Gemini 768-dim embeddings against stored Judge syntheses with cosine similarity threshold (`>= 0.65`).
  - Preserved persona independence boundary (FR-23): past context is routed exclusively to The Judge; Quant, Strategist, and Behaviorist remain completely blind to past sessions.
  - Amended The Judge's cognitive prompt (`lib/engine/prompts.ts`) per PRD v1.2 §20.7 to evaluate historical precedent, note recurring cognitive biases, and output `pattern_note` (FR-24).
  - Updated `JUDGE_SCHEMA` (`lib/engine/schemas.ts`) and TypeScript types (`lib/engine/types.ts`) with nullable `pattern_note`.
  - Built JSON export endpoint (`GET /api/export`, `app/api/export/route.ts`) supporting single-session and bulk backup.
  - Implemented secure export decryption flag (`?decrypt=true` authorized via `x-odin-access-passcode`), ensuring ciphertext privacy by default while providing 100% human-readable data portability on demand.
  - Added UI triggers for encrypted and decrypted JSON exports in `CaseHistoryDrawer`.
  - Added dynamic amber cybernetic alert card `RECOGNIZED DECISION PATTERN` in the HUD when The Judge identifies semantic precedent.
  - Added content-hygiene security reminder below raw narrative intake field.
- **Phase 2 Milestone 5 (M5) — Cybernetic Case-History Archive & Re-opening Interface**:
  - Built cybernetic `CaseHistoryDrawer` component (`components/CaseHistoryDrawer.tsx`) providing fast search, filtering, and timestamped dossier listings.
  - Implemented one-tap session re-opening (`handleReopenSession`), populating all 4 persona tabs and decrypting sensitive raw narratives server-side on demand (FR-15 & FR-17).
  - Built in-UI hard deletion (`handleDeleteSession`) with safety confirmation, permanently purging records and vector embeddings from Supabase (FR-21).
  - Added dashboard view mode switcher (`[ DECISION INTAKE CONSOLE ]` | `[ CASE HISTORY ARCHIVE ]`) with real-time archive counter badge.
  - Handled Supabase free-tier auto-pause states gracefully, displaying PRD §21.2 verbatim status string `"Waking the archive…"`.
  - Added historic inspection banner to the deliverables viewer indicating decryption status and original record metadata.
- **Phase 2 Milestone 4 (M4) — Web Speech API Voice I/O & Readback**:
  - Implemented client-side voice dictation (`lib/voice/useSpeechRecognition.ts`) for continuous speech-to-text into all 3 dilemma fields (`core_objectives`, `known_constraints`, `raw_narrative`).
  - Embedded PRD §21.2 verbatim status strings (`"Listening…"`, `"Transcribing…"`) with real-time interim transcript preview.
  - Built tactile `VoiceMicButton` components with pulsing active rings, audio simulation, and FR-14 fallback notifications for unsupported browsers.
  - Implemented speech synthesis readout (`lib/voice/useSpeechSynthesis.ts`, `components/VoiceReadbackController.tsx`) to vocalize the Judge's synthesis and sequenced next 3 actions with play, pause, and stop controls.
  - Added CSS animated audio equalizer bars (`app/globals.css`) for visual transmission feedback adhering to Emil Kowalski motion principles.
  - Preserved strict $0 cost ceiling by leveraging browser-native Web Speech APIs instead of metered audio token APIs.
- **Phase 2 Milestone 3 (M3) — Supabase Persistent Storage, RLS & App-Layer Encryption**:
  - Implemented Postgres + `pgvector` schema migration (`scripts/migrations/01_create_sessions_pgvector.sql`) for persistent decision storage.
  - Activated Row-Level Security (RLS) denying public/anonymous REST access to protect case history (FR-16).
  - Built AES-256-GCM authenticated symmetric encryption in `lib/crypto.ts` for sensitive narrative data (`raw_narrative_encrypted`), decrypted exclusively on server-side reads (FR-17).
  - Integrated Gemini 768-dimensional vector embeddings in `lib/embeddings.ts` generated strictly from `judge_output.synthesis` (preserving privacy boundaries per PRD §10).
  - Built case history and session management endpoints (`GET /api/sessions`, `GET /api/sessions/[id]`, and `DELETE /api/sessions/[id]` for FR-21 hard deletion), fully protected by the M2.5 Passcode Gate.
  - Automatically wired session persistence into `/api/analyze/route.ts` upon successful 4-persona synthesis.
  - Implemented automated verification test suites (`scripts/test-encryption.ts`, `scripts/test-supabase.ts`) confirming 100% round-trip integrity, RLS denial, and hard deletion.
- **Phase 2 Milestone 2.5 (M2.5) — Secret Access Passcode Gate & Quota Protection**:
  - Implemented access control gate via `ODIN_ACCESS_PASSCODE` to safeguard Gemini API quotas on public Vercel deployments.
  - Hardened `/api/analyze` to immediately block unauthorized requests and public crawlers with HTTP 401 before any model execution.
  - Built Cybernetic HUD Security Clearance widget (`app/page.tsx`) with browser credential retention (`localStorage`) and visual clearance levels.
  - Updated Phase 2 roadmap in `BACKLOG.md` preparing for Supabase Auth and Row-Level Security (RLS) in Milestone 3.
- **Phase 2 Milestone 2 (M2) — Cognitive Reasoning Engine Ported to Next.js**:
  - Ported the 4-persona sequential reasoning engine (The Quant, The Strategist, The Behaviorist, The Judge) to server-side Next.js using `@google/genai`.
  - Embedded verbatim Section 20 system prompts and strict JSON schema contracts (`lib/engine/prompts.ts`, `lib/engine/schemas.ts`, `lib/engine/types.ts`).
  - Implemented resilient sequential orchestrator (`lib/engine/orchestrator.ts`) with exponential backoff retries for 429/503 rate limits and 2-second RPM quota pacing.
  - Pinned cognitive engine model string to `gemini-3.6-flash`.
  - Built serverless API route `app/api/analyze/route.ts` with input validation and dual output modes: standard JSON response and Server-Sent Events (SSE) streaming for real-time UI status updates.
  - Implemented end-to-end verification test suite (`scripts/test-engine.ts`) verifying full synthesis, Section 20 schema compliance, 3 sequenced actions, and valid Mermaid.js flowchart generation.
- **Phase 2 Milestone 1 (M1) — Next.js Scaffold, Cybernetic UI & Vercel Deployment**:
  - Bootstrapped Next.js 15 (React 19, TypeScript) App Router scaffold with zero-conflict coexistence alongside legacy Phase 1 Python files.
  - Implemented cybernetic aesthetic design system (`app/globals.css`) adhering to Emil Kowalski & Impeccable motion principles: custom cubic-bezier easings (`cubic-bezier(0.23, 1, 0.32, 1)`), tactile `:active` press scaling (`0.97`), staggered entrances, and deep space glassmorphic cards.
  - Built real-time HUD telemetry dashboard (`app/page.tsx`) with 5-Layer AIM architecture status monitors and dynamic environment probe widgets.
  - Implemented safe runtime configuration validation (`lib/env.ts`) and serverless diagnostic route (`app/api/health/route.ts`) enforcing zero secret leakage into client bundles or API payloads.
  - Hardened `.gitignore` to prevent secret leakage (`.env*.local`, `node_modules/`, `.next/`), verified clean passing of `gitleaks` pre-commit hook.
  - Configured Supabase connection credentials and validated production build for zero-cost continuous deployment on Vercel.
- **Phase 2 Foundations**: Updated PRD to v1.2. Pivot from Streamlit to Next.js (React) + Supabase + Web Speech API.
- **Security & Governance Protocols**: Integrated 5 core protocols into the project foundation:
  - Universal IT Project Development Protocol (v1.0)
  - Agentic Infrastructure Manifest (AIM)
  - Cybersecurity Protocol for Vibecoding
  - Universal Project Security Protocol
  - Supplementary Modern Cybersecurity Development Whitepaper
- **Guardrails**: Scaffolded `.agents/hooks/pre_tool_check.py` implementing ClawGuardInterceptor logic to enforce deterministic boundaries on AI agent actions.

## [0.2.2] - Phase 1 Cloud MVP

### Added
- Initialized MVP planning phase.
- Project foundation scaffolding (README, CHANGELOG, BACKLOG, ARCHITECTURE).
- Configured 5-layer Agent Architecture `.agents` directory per AIM protocol.
- Configured Python `pre-commit` hook for `gitleaks` scanning.
- **Milestone 2**: Implemented four-persona cognitive engine (Quant, Strategist, Behaviorist, Judge) using `google-genai` and `pydantic`.
- **Milestone 3**: Built Streamlit UI with structured intake form and progressive disclosure status widget.
- **Milestone 4**: Converted side-by-side columns into a mobile-friendly `st.tabs` layout and verified responsive viewport rendering.
- **Milestone 5**: Hardened Streamlit inputs (`max_chars`), fortified Pydantic schemas (`max_length`), and sanitized Python exception outputs for production security.
