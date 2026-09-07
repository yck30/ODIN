import { Type, type Schema } from "@google/genai";

/**
 * Strict Gemini responseSchema definitions per Section 20 of .agents/skills/persona_prompts.md
 */

export const QUANT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    persona: {
      type: Type.STRING,
      description: "Identifier for this persona. Must be 'quant'.",
    },
    summary: {
      type: Type.STRING,
      description: "1-2 sentence headline summary of quantitative findings.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Full mathematical, expected value, and probability analysis in markdown format.",
    },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-5 extracted key quantitative takeaways.",
    },
    confidence: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Confidence level of quantitative analysis based on available signal.",
    },
    paths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the decision path." },
          probability: {
            type: Type.NUMBER,
            description: "Estimated numeric probability (0.0 - 1.0) or null if signal is insufficient.",
          },
          expected_value_notes: {
            type: Type.STRING,
            description: "Expected value calculation or qualitative relative likelihood notes.",
          },
        },
        required: ["name", "expected_value_notes"],
      },
      description: "List of realistic paths forward with expected value assessments.",
    },
  },
  required: ["persona", "summary", "reasoning", "key_points", "confidence", "paths"],
};

export const STRATEGIST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    persona: {
      type: Type.STRING,
      description: "Identifier for this persona. Must be 'strategist'.",
    },
    summary: {
      type: Type.STRING,
      description: "1-2 sentence headline summary of strategic positioning.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Full game theory, reversibility, and second-order effect analysis in markdown format.",
    },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-5 extracted key strategic takeaways.",
    },
    confidence: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Confidence level of strategic assessment.",
    },
    domain_framing: {
      type: Type.STRING,
      enum: ["adversarial", "non_adversarial"],
      description: "Classification of the domain based on user scenario.",
    },
    reversibility_ranking: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          move: { type: Type.STRING, description: "Action or move evaluated." },
          reversibility: {
            type: Type.STRING,
            enum: ["low", "medium", "high"],
            description: "Reversibility score: low = irreversible; high = easily walked back.",
          },
          notes: { type: Type.STRING, description: "Strategic rationale and sequencing advice." },
        },
        required: ["move", "reversibility", "notes"],
      },
      description: "Ranked list of moves ordered from lowest to highest reversibility risk.",
    },
  },
  required: ["persona", "summary", "reasoning", "key_points", "confidence", "domain_framing", "reversibility_ranking"],
};

export const BEHAVIORIST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    persona: {
      type: Type.STRING,
      description: "Identifier for this persona. Must be 'behaviorist'.",
    },
    summary: {
      type: Type.STRING,
      description: "1-2 sentence headline summary of psychological and bias audit.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Full behavioral economics audit and blind spot detection in markdown format.",
    },
    key_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2-5 extracted psychological and behavioral observations.",
    },
    confidence: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Confidence level of behavioral evaluation.",
    },
    biases_detected: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          bias: {
            type: Type.STRING,
            description: "Specific bias audited (e.g. sunk_cost_fallacy, confirmation_bias, overconfidence).",
          },
          present: {
            type: Type.BOOLEAN,
            description: "Whether the bias was observed in the narrative.",
          },
          evidence: {
            type: Type.STRING,
            description: "Quote or paraphrase from narrative, or 'not observed'.",
          },
        },
        required: ["bias", "present", "evidence"],
      },
      description: "Audit of cognitive distortions with textual evidence standard.",
    },
  },
  required: ["persona", "summary", "reasoning", "key_points", "confidence", "biases_detected"],
};

export const JUDGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    synthesis: {
      type: Type.STRING,
      description: "First principles synthesis reconciling the Quant, Strategist, and Behaviorist outputs.",
    },
    tension_points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Explicit points where persona analyses collided and how First Principles resolved them.",
    },
    recommended_path: {
      type: Type.STRING,
      description: "The concrete, definitive recommended course of action.",
    },
    next_3_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly three concrete, sequenced next actions ordered by execution priority.",
    },
    mermaid_diagram: {
      type: Type.STRING,
      description: "Valid Mermaid.js syntax for a flowchart visualizing the decision tree and branch points.",
    },
  },
  required: ["synthesis", "tension_points", "recommended_path", "next_3_actions", "mermaid_diagram"],
};
