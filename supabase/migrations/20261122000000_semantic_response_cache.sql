-- ============================================================================
-- Semantic AI Response Cache
-- Stores AI-generated answers alongside their embedding vectors so that
-- semantically equivalent future questions can be served instantly without
-- hitting the LLM.
--
-- Strategy:
--   1. Exact-match dedup via SHA-256 hash (zero embedding cost).
--   2. Approximate-nearest-neighbour via pgvector cosine distance for
--      semantically similar questions that aren't worded identically.
--
-- Only context-independent answers (no user-uploaded material scope) are
-- cached here.  Material-scoped responses are inherently per-user and must
-- never be reused across accounts.
-- ============================================================================

-- pgvector is enabled by default on all Supabase projects.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Main cache table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_response_cache (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fast dedup key: lowercase-trimmed SHA-256 of the normalised question text.
  question_hash   TEXT        NOT NULL,

  -- Full original question kept for auditing / analytics.
  question_text   TEXT        NOT NULL,

  -- 768-dim vector produced by gemini-embedding-001 (RETRIEVAL_QUERY task).
  embedding       VECTOR(768) NOT NULL,

  -- The AI-generated answer stored verbatim.
  answer_text     TEXT        NOT NULL,

  -- Telemetry -----------------------------------------------------------------
  model_used      TEXT,
  request_type    TEXT        NOT NULL DEFAULT 'chat',
  hit_count       INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps ----------------------------------------------------------------
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional TTL.  NULL = never expire.
  expires_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Unique exact-match dedup — prevents duplicates even under concurrent inserts.
CREATE UNIQUE INDEX IF NOT EXISTS ai_response_cache_hash_uidx
  ON ai_response_cache (question_hash);

-- IVFFlat index for approximate nearest-neighbour search.
-- lists=50 is appropriate for up to ~500k rows; bump to 100 at 1M+ rows.
CREATE INDEX IF NOT EXISTS ai_response_cache_embedding_idx
  ON ai_response_cache USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- Request-type filter pushed down to the index scan.
CREATE INDEX IF NOT EXISTS ai_response_cache_request_type_idx
  ON ai_response_cache (request_type);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- This table is server-side only; no client should ever query it directly.
-- All access goes through Next.js API routes using the service-role key.
-- ---------------------------------------------------------------------------
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
-- No permissive policies = all client-key access is denied by default.

-- ---------------------------------------------------------------------------
-- RPC: find_cached_response
-- Returns the single closest cache entry that meets the similarity threshold.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_cached_response(
  p_embedding    VECTOR(768),
  p_threshold    FLOAT         DEFAULT 0.95,
  p_request_type TEXT          DEFAULT 'chat'
)
RETURNS TABLE (
  id          UUID,
  answer_text TEXT,
  similarity  FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    answer_text,
    1 - (embedding <=> p_embedding) AS similarity
  FROM  ai_response_cache
  WHERE request_type = p_request_type
    AND (expires_at IS NULL OR expires_at > now())
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record_cache_hit
-- Atomically increments the hit counter and refreshes last_hit_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_cache_hit(p_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE ai_response_cache
  SET
    hit_count  = hit_count + 1,
    last_hit_at = now()
  WHERE id = p_id;
$$;

-- Grants
GRANT ALL ON TABLE ai_response_cache TO service_role;
GRANT EXECUTE ON FUNCTION find_cached_response TO service_role;
GRANT EXECUTE ON FUNCTION record_cache_hit TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
