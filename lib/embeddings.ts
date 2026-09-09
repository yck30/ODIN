import { GoogleGenAI } from "@google/genai";

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Generates vector embeddings for text using Google's Gemini embeddings API.
 *
 * CRITICAL PRIVACY RULE (PRD v1.2 §10 & §20):
 * Do NOT pass `raw_narrative` directly to this function.
 * Always embed `judge_output.synthesis` (downstream abstraction) or query terms.
 * Embedding the plaintext narrative would leak sensitive content into the vector store,
 * undermining the app-layer encryption controls.
 */
export async function generateEmbedding(
  text: string,
  apiKey: string,
  model: string = DEFAULT_EMBEDDING_MODEL,
  dimensions: number = EMBEDDING_DIMENSIONS
): Promise<{ embedding: number[]; model: string }> {
  const cleanText = text?.trim();
  if (!cleanText) {
    throw new Error("Embedding generation error: text cannot be empty.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model,
    contents: cleanText,
    config: {
      outputDimensionality: dimensions,
    },
  });

  // Support both single and batched embedding response formats across SDK versions
  interface RawEmbeddingResponse {
    embedding?: { values?: number[] };
    embeddings?: Array<{ values?: number[] }>;
  }

  const raw = response as RawEmbeddingResponse;
  const values = raw.embeddings?.[0]?.values || raw.embedding?.values;

  if (!values || !Array.isArray(values) || values.length === 0) {
    throw new Error(`Embedding model ${model} did not return vector values.`);
  }

  return {
    embedding: values,
    model,
  };
}
