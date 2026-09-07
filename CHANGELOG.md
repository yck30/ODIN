# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 2 Foundations**: Updated PRD to v1.2. Pivot planned from Streamlit to Next.js (React) + Supabase + Web Speech API.
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
