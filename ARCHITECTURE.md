# Architecture & Technical Specification

O.D.I.N. is a zero-cost decision-support system built upon a strict 5-layer agentic architecture, combining conversational intelligence with deterministic guardrails.

## Tech Stack
- **Frontend/Backend:** Streamlit
- **Hosting:** Streamlit Community Cloud
- **Cognitive Engine:** Current-gen Gemini Flash (via Google AI Studio)
- **Output Mode:** Gemini Structured Output (JSON `responseSchema`)
- **Version Control:** Public GitHub Repository

## The 5-Layer Agent Architecture (AIM Protocol)
This project adheres to the Agentic Infrastructure Manifest (AIM) to ensure trustworthy human-agent collaboration.

### Layer 1: Memory Layer (`.agents/constitution.md`)
Defines the immutable global rules, security guardrails, and non-negotiable behavior boundaries for AI agents operating in this repository.

### Layer 2: Knowledge Layer (`.agents/skills/`)
Task-specific execution playbooks and context rules.
- `git_workflow.md`: Branching and commit conventions.
- `gemini_api_integration.md`: API usage, rate limits, and structured output rules.
- `persona_prompts.md`: The verbatim prompts and schemas for the reasoning engine.

### Layer 3: Guardrail Layer (`.agents/hooks/` & `.pre-commit-config.yaml`)
Deterministic software tripwires.
- Pre-commit scanning via `gitleaks` (Type B commit-time hook) ensures secrets never enter the repository.
- `pre_tool_check.py` serves as a blueprint for agent action interception.

### Layer 4: Delegation Layer (`.agents/subagents/`)
Specialized subagents. (Currently placeholder, as Phase 1 does not implement autonomous swarm topologies).

### Layer 5: Distribution Layer (`.github/workflows/`)
Deployment and CI/CD operations. A basic GitHub Action pipeline enforces security scans on pushes to `main`.

## Cognitive Reasoning Engine
The core of O.D.I.N. relies on four sequential, independent calls to the Gemini API, governed by structured JSON schemas:
1. **The Quant:** Operations Research & Statistics (Probability trees, expected value).
2. **The Strategist:** Game Theory & Sun Tzu (Reversibility ranking, adversarial modeling).
3. **The Behaviorist:** Behavioral Economics & Risk Auditing (Bias detection).
4. **The Judge:** First Principles Arbitration (Synthesizes the three independent analyses into a concrete set of next actions).
