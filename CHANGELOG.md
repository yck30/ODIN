# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
