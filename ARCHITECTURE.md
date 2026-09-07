# Architecture & Technical Specification

O.D.I.N. is a zero-cost decision-support system built upon a strict 5-layer agentic architecture, combining conversational intelligence with deterministic guardrails.

## Tech Stack (Phase 2: JARVIS Interface)
- **Frontend/Backend:** Next.js (React) with serverless API routes
- **Hosting:** Vercel (Free tier)
- **Voice I/O:** Browser-native Web Speech API (`SpeechRecognition` + `SpeechSynthesis`)
- **Persistent Storage:** Supabase (Postgres + `pgvector`) (Free tier)
- **Cognitive Engine:** Gemini 3.5 Flash (via Google AI Studio)
- **Output Mode:** Gemini Structured Output (JSON `responseSchema`)
- **Version Control:** Public GitHub Repository

## Security & Data Model
- **Row-Level Security (RLS)**: Enforced on all Supabase tables (`sessions`, `session_outcomes`).
- **Encryption**: App-layer symmetric encryption (Node's built-in `crypto`) for `raw_narrative` and `session_outcomes.narrative` before write, decrypted only server-side.
- **Data Export**: Documented JSON export for portability, retaining embedding-model version tracking.
- **Server-Side Secrets**: Supabase service-role keys and Gemini API keys reside exclusively in Vercel environment variables.

## The 5-Layer Agent Architecture (AIM Protocol)
This project adheres to the Agentic Infrastructure Manifest (AIM) to ensure trustworthy human-agent collaboration and Zero-Trust boundary enforcement.

### Layer 1: Memory Layer (`.agents/constitution.md`)
Defines the immutable global rules, security guardrails, and non-negotiable behavior boundaries for AI agents operating in this repository. Includes strict Conversational Competence constraints (Okanagan Agent Pattern) and RACI matrix enforcement.

### Layer 2: Knowledge Layer (`.agents/skills/`)
Task-specific execution playbooks and context rules.
- `git_workflow.md`: Branching and commit conventions.
- `gemini_api_integration.md`: API usage, rate limits, and structured output rules.
- `persona_prompts.md`: The verbatim prompts and schemas for the reasoning engine.
- `supabase_integration.md`: RLS policies, `pgvector` schemas, encryption implementations.
- `web_speech_api.md`: Voice fallback handlers and locale constraints.

### Layer 3: Guardrail Layer (`.agents/hooks/` & `.pre-commit-config.yaml`)
Deterministic software tripwires preventing hallucinated tool actions and credential leakage.
- `pre-commit` scanning via `gitleaks` (Type B commit-time hook) ensures secrets never enter the repository.
- `pre_tool_check.py` implements ClawGuardInterceptor logic to enforce task-scoped constraints on agent execution (e.g., preventing auto-execution of risky terminal commands).

### Layer 4: Delegation Layer (`.agents/subagents/`)
Specialized subagents. (Currently placeholder, as Phase 2 does not implement autonomous swarm topologies; LangGraph is deferred to Phase 3).

### Layer 5: Distribution Layer (`.github/workflows/`)
Deployment and CI/CD operations. A basic GitHub Action pipeline enforces security scans on pushes to `main`.

## Cognitive Reasoning Engine
The core of O.D.I.N. relies on four sequential, independent calls to the Gemini API, governed by structured JSON schemas:
1. **The Quant:** Operations Research & Statistics (Probability trees, expected value).
2. **The Strategist:** Game Theory & Sun Tzu (Reversibility ranking, adversarial modeling).
3. **The Behaviorist:** Behavioral Economics & Risk Auditing (Bias detection).
4. **The Judge:** First Principles Arbitration (Synthesizes the three independent analyses, integrating similarity-matched `past_context` and recorded `session_outcomes` from the pgvector case history, into a concrete set of next actions).
