/**
 * Decision Intake & Persona Response Types for O.D.I.N. (Phase 2)
 * Strictly adhering to Section 20 of .agents/skills/persona_prompts.md
 */

export interface DecisionIntake {
  core_objectives: string;
  known_constraints: string;
  raw_narrative: string;
}

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * 20.3 Common Persona Output Envelope
 */
export interface CommonEnvelope {
  persona: "quant" | "strategist" | "behaviorist";
  summary: string; // 1-2 sentence headline
  reasoning: string; // full analysis, markdown-flavored text
  key_points: string[]; // 2-5 extracted takeaways
  confidence: ConfidenceLevel;
}

/**
 * 20.4 The Quant — Operations Research & Statistics
 */
export interface QuantPath {
  name: string;
  probability: number | null; // null when unsupported by input
  expected_value_notes: string;
}

export interface QuantOutput extends CommonEnvelope {
  persona: "quant";
  paths: QuantPath[];
}

/**
 * 20.5 The Strategist — Game Theory & Sun Tzu
 */
export interface ReversibilityMove {
  move: string;
  reversibility: "low" | "medium" | "high";
  notes: string;
}

export interface StrategistOutput extends CommonEnvelope {
  persona: "strategist";
  domain_framing: "adversarial" | "non_adversarial";
  reversibility_ranking: ReversibilityMove[];
}

/**
 * 20.6 The Behaviorist — Behavioral Economics & Risk Auditing
 */
export interface DetectedBias {
  bias: string; // e.g. "sunk_cost_fallacy"
  present: boolean;
  evidence: string; // quote/paraphrase from narrative, or "not observed"
}

export interface BehavioristOutput extends CommonEnvelope {
  persona: "behaviorist";
  biases_detected: DetectedBias[];
}

/**
 * 20.7 Cross-Session Recall Past Context Outcome (v1.2 Addendum extension)
 */
export interface PastContextOutcome {
  status: "followed_path" | "deviated" | "still_deciding";
  narrative_summary: string | null;
}

/**
 * 20.7 Cross-Session Recall Past Context Item (v1.1 amendment, extended in v1.2)
 */
export interface PastContextItem {
  id?: string;
  date: string;
  synthesis: string;
  outcome?: PastContextOutcome | null;
  similarity?: number;
}

/**
 * 20.7 The Judge — First Principles Arbitration (amended in v1.1)
 */
export interface JudgeOutput {
  synthesis: string;
  tension_points: string[]; // where personas collided, and how it was resolved
  recommended_path: string;
  next_3_actions: [string, string, string]; // exactly 3, each non-empty, sequenced
  mermaid_diagram: string; // valid Mermaid.js syntax
  pattern_note: string | null; // added in v1.1
}

/**
 * Full 4-Stage Analysis Result
 */
export interface FullAnalysisResult {
  intake: DecisionIntake;
  quant: QuantOutput;
  strategist: StrategistOutput;
  behaviorist: BehavioristOutput;
  judge: JudgeOutput;
  metadata: {
    model: string;
    timestamp: string;
    totalDurationMs: number;
  };
}
