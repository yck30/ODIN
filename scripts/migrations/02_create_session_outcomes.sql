-- ==============================================================================
-- O.D.I.N. Database Migration: 02_create_session_outcomes.sql
-- Phase 2 — Milestone N1 (v1.2 Addendum: Outcome-Feedback Loop)
--
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- 1. Create `session_outcomes` table adhering strictly to PRD v1.2 §10 & FR-26
CREATE TABLE IF NOT EXISTS public.session_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('followed_path', 'deviated', 'still_deciding')),
    narrative_encrypted BYTEA,
    prompted_via TEXT NOT NULL CHECK (prompted_via IN ('opportunistic', 'manual')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create index on session_id for fast lookup
CREATE INDEX IF NOT EXISTS session_outcomes_session_id_idx
ON public.session_outcomes (session_id);

-- 3. Enforce Row-Level Security (RLS) from Day 1 (PRD §8, FR-26)
ALTER TABLE public.session_outcomes ENABLE ROW LEVEL SECURITY;

-- Explicitly deny all public/anon/authenticated client-side REST access.
-- Server-side Next.js API routes utilize SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS),
-- guaranteeing that sensitive outcome narratives and statuses are never accessible via public endpoints.
DROP POLICY IF EXISTS "Deny all public access to session_outcomes" ON public.session_outcomes;
CREATE POLICY "Deny all public access to session_outcomes"
ON public.session_outcomes
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 4. Trigger to automatically update updated_at on modification
CREATE OR REPLACE FUNCTION public.update_session_outcomes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_session_outcomes_updated_at ON public.session_outcomes;
CREATE TRIGGER tr_session_outcomes_updated_at
BEFORE UPDATE ON public.session_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.update_session_outcomes_timestamp();
