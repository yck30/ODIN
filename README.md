# O.D.I.N. (Omni-Dimensional Intelligence Node)

*O.D.I.N. is a zero-cost decision-support system that forces high-stakes dilemmas through four independent reasoning passes — cold optimization, adversarial strategy, behavioral-bias audit, and first-principles arbitration — rather than returning one generalized, risk-averse answer. It is now accessible by voice and builds a persistent case history across decisions, without compromising the zero-cost or reasoning-design commitments.*

## Overview
This project is a private digital twin acting as a cognitive co-pilot. It uses Google's Gemini Flash model and Next.js to synthesize decisions with strict mathematical, strategic, and behavioral rigor, while maintaining long-term case history via Supabase (pgvector).

## Guiding Priorities
1. **Zero-Cost, Always:** No component whose free access is a depleting credit rather than a durable tier.
2. **Feature-Complete Over Fast:** Voice I/O and persistent memory ship together in Phase 2.
3. **Architecture Is Disposable, the Reasoning Design Isn’t:** The four-persona-plus-Judge design is frozen; frontend, host, and interaction mode are mutable.
4. **Privacy Is Knowingly Traded Away:** The repo is public, but user content stored server-side is protected by Row-Level Security (RLS) and app-layer symmetric encryption.

## Local Setup
1. Clone the repository.
2. Install dependencies via npm: `npm install`
3. Configure your `.env.local` with your API keys:
   ```env
   GEMINI_API_KEY="your-api-key-here"
   SUPABASE_URL="your-supabase-project-url"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ENCRYPTION_KEY="your-symmetric-crypto-key"
   ```
   **Important:** Do NOT commit your `.env.local`. A pre-commit hook is installed to prevent secret leaks.
4. Run the development server: `npm run dev`
5. Navigate to `http://localhost:3000` to interact with O.D.I.N.
