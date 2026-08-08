# Gemini API Integration

**Layer 2 - Knowledge Layer**

This document details the configuration for the Gemini API in the O.D.I.N. project.

## Configuration Rules
- **Model Selection:** Use the current-gen Gemini Flash model. The model string identifier MUST be pinned in exactly ONE configuration variable, never hardcoded in prompt logic.
- **Structured Output:** All persona calls (Quant, Strategist, Behaviorist) and the Judge call must enforce JSON output by configuring `response_mime_type: "application/json"` and passing the precise `responseSchema` (from `persona_prompts.md`).
- **Free-Tier Limits:**
  - O.D.I.N. relies on Google AI Studio's free tier.
  - 4 calls are made per session (which sits well within the daily quota).
- **Error Handling (Quota/Rate Limits):**
  - If a 429 (Rate Limit) or Quota Exhausted error occurs, the application must catch the exception and surface a clear, specific "try again after quota reset" message to the user. A raw Streamlit exception or silent hang is unacceptable.
- **Error Handling (Schema Violation):**
  - If the model returns malformed JSON or fails the schema validation, the app must retry EXACTLY ONCE with an explicit schema-violation correction prompt.
  - If the retry fails, fallback to the graceful error pattern (do not expose a raw parse exception to the user).
