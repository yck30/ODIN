# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- **Phase 2 Milestone 5 (M5) — JARVIS Case-History Archive & Re-opening Interface**:
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
  - Built JARVIS HUD Security Clearance widget (`app/page.tsx`) with browser credential retention (`localStorage`) and visual clearance levels.
  - Updated Phase 2 roadmap in `BACKLOG.md` preparing for Supabase Auth and Row-Level Security (RLS) in Milestone 3.
- **Phase 2 Milestone 2 (M2) — Cognitive Reasoning Engine Ported to Next.js**:
  - Ported the 4-persona sequential reasoning engine (The Quant, The Strategist, The Behaviorist, The Judge) to server-side Next.js using `@google/genai`.
  - Embedded verbatim Section 20 system prompts and strict JSON schema contracts (`lib/engine/prompts.ts`, `lib/engine/schemas.ts`, `lib/engine/types.ts`).
  - Implemented resilient sequential orchestrator (`lib/engine/orchestrator.ts`) with exponential backoff retries for 429/503 rate limits and 2-second RPM quota pacing.
  - Pinned cognitive engine model string to `gemini-3.6-flash`.
  - Built serverless API route `app/api/analyze/route.ts` with input validation and dual output modes: standard JSON response and Server-Sent Events (SSE) streaming for real-time UI status updates.
  - Implemented end-to-end verification test suite (`scripts/test-engine.ts`) verifying full synthesis, Section 20 schema compliance, 3 sequenced actions, and valid Mermaid.js flowchart generation.
- **Phase 2 Milestone 1 (M1) — Next.js Scaffold, JARVIS UI & Vercel Deployment**:
  - Bootstrapped Next.js 15 (React 19, TypeScript) App Router scaffold with zero-conflict coexistence alongside legacy Phase 1 Python files.
  - Implemented JARVIS aesthetic design system (`app/globals.css`) adhering to Emil Kowalski & Impeccable motion principles: custom cubic-bezier easings (`cubic-bezier(0.23, 1, 0.32, 1)`), tactile `:active` press scaling (`0.97`), staggered entrances, and deep space glassmorphic cards.
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
