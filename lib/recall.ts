import { getServerSupabaseClient } from "./supabase/server";
import { generateEmbedding } from "./embeddings";
import type { PastContextItem } from "./engine/types";

export const DEFAULT_SIMILARITY_THRESHOLD = 0.65;
export const MAX_RECALL_MATCHES = 3;

/**
 * Searches the Supabase vector store for the 0-3 most semantically similar past decisions.
 *
 * CRITICAL PRIVACY BOUNDARY (PRD v1.2 §10 & §20.7):
 * - The query embedding is generated strictly from `objectives + " " + constraints`.
 * - It retrieves ONLY the downstream `judge_output.synthesis`, NEVER raw_narrative_encrypted.
 * - If the history is empty or Supabase is paused/unreachable, returns [] without throwing (FR-22).
 */
export async function findSimilarPastDecisions(
  objectives: string,
  constraints: string,
  apiKey: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  count: number = MAX_RECALL_MATCHES
): Promise<PastContextItem[]> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    return [];
  }

  const queryText = `${objectives.trim()} ${constraints.trim()}`.trim();
  if (!queryText) {
    return [];
  }

  try {
    // 1. Generate query vector using Gemini embedding model
    const { embedding } = await generateEmbedding(queryText, apiKey);

    // 2. Query Supabase RPC match_past_sessions (created in migration 01)
    const serverClient = getServerSupabaseClient();
    const { data, error } = await serverClient.rpc("match_past_sessions", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
    });

    if (error) {
      console.warn("[O.D.I.N. Recall] Notice: Vector match RPC failed or database paused:", error.message);
      return [];
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    // 3. Format matches into clean PastContextItem envelopes for the Judge call
    return data.map((row: any) => ({
      id: row.id,
      date: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "unknown",
      synthesis: row.synthesis || "",
      similarity: row.similarity ? Number(row.similarity.toFixed(3)) : undefined,
    }));
  } catch (err: unknown) {
    console.warn(
      "[O.D.I.N. Recall] Error querying memory archive:",
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}
