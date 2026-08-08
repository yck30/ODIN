# O.D.I.N. (Omni-Dimensional Intelligence Node)

*O.D.I.N. is a zero-cost decision-support system that forces high-stakes dilemmas through four independent reasoning passes — cold optimization, adversarial strategy, behavioral-bias audit, and first-principles arbitration — rather than returning one generalized, risk-averse answer.*

## Overview
This project is a private digital twin acting as a cognitive co-pilot. It uses Google's Gemini Flash model and Streamlit to synthesize decisions with strict mathematical, strategic, and behavioral rigor.

## Guiding Priorities
1. **Zero-Cost, Always:** Development, hosting, database, and model-inference cost stay at $0.
2. **Feature-Complete Over Fast:** All four reasoning personas and the Judge ship together.
3. **Architecture Is Disposable, the Reasoning Design Isn’t:** The four-persona-plus-Judge design is the core component that shouldn't be altered casually.
4. **Privacy Is Knowingly Traded Away:** The repo is public, and free-tier model providers may log or train on session content.

## Local Setup
1. Clone the repository.
2. Setup a virtual environment: `python -m venv .venv` and activate it.
3. Install dependencies: `pip install -r requirements.txt` (to be defined).
4. Configure your `.streamlit/secrets.toml` with your Gemini API key:
   ```toml
   GEMINI_API_KEY = "your-api-key-here"
   ```
   **Important:** Do NOT commit your `secrets.toml`. A pre-commit hook is installed to prevent secret leaks.
5. Run the app: `streamlit run src/app.py`
