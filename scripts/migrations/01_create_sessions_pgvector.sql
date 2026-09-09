-- ==============================================================================
-- O.D.I.N. Database Migration: 01_create_sessions_pgvector.sql
-- Phase 2 — Milestone 3 (M3)
--
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Enable pgvector extension for semantic similarity search over Judge syntheses
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create `sessions` table adhering strictly to PRD v1.2 §10
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    core_objectives TEXT NOT NULL,
    known_constraints TEXT NOT NULL,
    raw_narrative_encrypted BYTEA NOT NULL,
    quant_output JSONB NOT NULL,
    strategist_output JSONB NOT NULL,
    behaviorist_output JSONB NOT NULL,
    judge_output JSONB NOT NULL,
    narrative_embedding VECTOR(768) NOT NULL,
    embedding_model TEXT NOT NULL DEFAULT 'gemini-embedding-001'
);

-- 3. Enforce Row-Level Security (RLS) from Day 1 (PRD §8, FR-16)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Explicitly deny all public/anon/authenticated client-side REST access.
-- Server-side Next.js API routes utilize SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS)
-- ensuring that raw or encrypted sessions can never be queried directly through public Supabase endpoints.
DROP POLICY IF EXISTS "Deny all public access to sessions" ON public.sessions;
CREATE POLICY "Deny all public access to sessions"
ON public.sessions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 4. Create HNSW vector index for high-performance cosine similarity queries
CREATE INDEX IF NOT EXISTS sessions_narrative_embedding_hnsw_idx
ON public.sessions
USING hnsw (narrative_embedding vector_cosine_ops);

-- 5. Helper RPC function for cosine similarity match (for Phase 2 M5.5 recall)
CREATE OR REPLACE FUNCTION match_past_sessions (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  synthesis TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    (s.judge_output->>'synthesis')::TEXT AS synthesis,
    1 - (s.narrative_embedding <=> query_embedding) AS similarity
  FROM public.sessions s
  WHERE 1 - (s.narrative_embedding <=> query_embedding) >= match_threshold
  ORDER BY s.narrative_embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
