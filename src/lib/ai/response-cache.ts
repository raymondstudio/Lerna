/**
 * Semantic AI Response Cache
 *
 * Serves semantically identical questions from Postgres (pgvector) instead of
 * hitting the LLM.  Two lookup tiers keep cost down:
 *
 *   Tier 1 — Exact match  : SHA-256 hash of the normalised question (zero
 *                           embedding cost, sub-millisecond).
 *   Tier 2 — Fuzzy match  : cosine similarity via pgvector ANN search
 *                           (one cheap embedding call, ~100 ms).
 *
 * The cache is intentionally best-effort: every public function swallows
 * errors and falls back to the caller, so a Postgres hiccup never breaks
 * the chat endpoint.
 *
 * IMPORTANT – only cache context-independent answers.
 * Responses that depend on a user's uploaded materials (documentIds) must
 * never be cached here — the RAG context is per-user and reusing it across
 * accounts would produce hallucinated, wrong answers.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/gemini/client";

// ---------------------------------------------------------------------------
// Constants — adjust via env to avoid redeployments
// ---------------------------------------------------------------------------

/** Cosine similarity threshold [0, 1].  Raise to 0.97 for stricter matches;
 *  lower to 0.92 for higher hit-rate at the risk of slightly off answers. */
const SIMILARITY_THRESHOLD =
  Number(process.env.RESPONSE_CACHE_SIMILARITY_THRESHOLD) || 0.95;

/** Days before a cached entry expires.  Set to 0 to disable TTL. */
const TTL_DAYS = Number(process.env.RESPONSE_CACHE_TTL_DAYS) || 7;

/** Master kill-switch.  Set RESPONSE_CACHE_ENABLED=false to disable cache
 *  reads and writes without touching code. */
const CACHE_ENABLED =
  process.env.RESPONSE_CACHE_ENABLED !== "false";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheHit {
  /** Row UUID — useful for analytics / debugging. */
  id: string;
  /** The stored AI answer text. */
  answerText: string;
  /** Cosine similarity score [0, 1].  1.0 = exact hash match. */
  similarity: number;
  /** Which tier produced this hit. */
  tier: "exact" | "semantic";
}

export interface CacheStoreOptions {
  modelUsed?: string;
  requestType?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise before hashing to maximise exact-match dedup.
 * Lowercases, strips leading/trailing whitespace, and collapses runs of
 * whitespace to a single space.
 */
function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/** SHA-256 of the normalised question, hex-encoded. */
async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalise(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function expiresAt(): string | null {
  if (!TTL_DAYS) return null;
  return new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a cached response for `question`.
 *
 * Returns `null` on a miss, on a disabled cache, or when any internal
 * error occurs (cache failures are always transparent to the caller).
 */
export async function lookupResponseCache(
  question: string,
  requestType = "chat"
): Promise<CacheHit | null> {
  if (!CACHE_ENABLED) return null;

  try {
    const db = createSupabaseAdminClient();

    // ── Tier 1: exact hash match (no embedding cost) ──────────────────────
    const hash = await sha256(question);
    const { data: exact } = await db
      .from("ai_response_cache")
      .select("id, answer_text")
      .eq("question_hash", hash)
      .eq("request_type", requestType)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .maybeSingle();

    if (exact) {
      // Fire-and-forget: bump hit stats without blocking the response.
      void db.rpc("record_cache_hit", { p_id: exact.id });
      return { id: exact.id, answerText: exact.answer_text, similarity: 1.0, tier: "exact" };
    }

    // ── Tier 2: semantic / ANN search ─────────────────────────────────────
    const embedding = await generateEmbedding(normalise(question), "RETRIEVAL_QUERY");

    const { data: rows } = await db.rpc("find_cached_response", {
      p_embedding: embedding,
      p_threshold: SIMILARITY_THRESHOLD,
      p_request_type: requestType,
    });

    const nearest = Array.isArray(rows) ? rows[0] : null;
    if (!nearest) return null;

    void db.rpc("record_cache_hit", { p_id: nearest.id });

    return {
      id: nearest.id,
      answerText: nearest.answer_text,
      similarity: nearest.similarity,
      tier: "semantic",
    };
  } catch (err) {
    // Best-effort: log but never surface to the caller.
    console.warn("[response-cache] lookup failed — falling through to LLM", err);
    return null;
  }
}

/**
 * Persist a fresh AI answer so future semantically similar questions can
 * be served without hitting the LLM.
 *
 * Designed to be called fire-and-forget (`void storeResponseCache(…)`).
 * Duplicate inserts (same hash) are silently ignored via `ON CONFLICT DO NOTHING`.
 */
export async function storeResponseCache(
  question: string,
  answerText: string,
  options: CacheStoreOptions = {}
): Promise<void> {
  if (!CACHE_ENABLED) return;

  try {
    const [hash, embedding] = await Promise.all([
      sha256(question),
      generateEmbedding(normalise(question), "RETRIEVAL_DOCUMENT"),
    ]);

    const db = createSupabaseAdminClient();
    await db.from("ai_response_cache").upsert(
      {
        question_hash: hash,
        question_text: question,
        embedding,
        answer_text: answerText,
        model_used: options.modelUsed ?? null,
        request_type: options.requestType ?? "chat",
        expires_at: expiresAt(),
      },
      // Exact duplicates (same question phrasing) are ignored rather than
      // overwriting so we preserve the original hit_count accumulation.
      { onConflict: "question_hash", ignoreDuplicates: true }
    );
  } catch (err) {
    console.warn("[response-cache] store failed — answer will be regenerated next time", err);
  }
}
