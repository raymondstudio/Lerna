import { selectReadyOwnedMaterialIds } from "@/lib/repositories/materials";
import { generateEmbedding } from "@/lib/gemini/client";
import type { ChatSource } from "@/lib/chat/types";
import { searchMaterialEmbeddings } from "./elastic";
import type { RagContext, RetrievedMaterialChunk } from "./types";

const MIN_RELEVANCE_SCORE = 0.62;

function sourceLabel(chunk: RetrievedMaterialChunk) {
  const details = [
    chunk.page ? `page ${chunk.page}` : null,
    chunk.slide ? `slide ${chunk.slide}` : null,
    chunk.chapter ? chunk.chapter : null,
    chunk.section ? chunk.section : null,
  ].filter(Boolean);

  return details.length > 0 ? `${chunk.documentName} (${details.join(", ")})` : chunk.documentName;
}

function toSource(chunk: RetrievedMaterialChunk): ChatSource {
  return {
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkId: chunk.id,
    page: chunk.page,
    slide: chunk.slide,
    chapter: chunk.chapter,
    section: chunk.section,
    score: chunk.score,
  };
}

function uniqueSources(chunks: RetrievedMaterialChunk[]) {
  const seen = new Set<string>();
  const sources: ChatSource[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.documentId}:${chunk.page ?? ""}:${chunk.slide ?? ""}:${chunk.chapter ?? ""}:${chunk.section ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sources.push(toSource(chunk));
  }

  return sources.slice(0, 5);
}

export function formatRagContext(chunks: RetrievedMaterialChunk[]) {
  if (chunks.length === 0) {
    return "No uploaded-material context was retrieved for this question.";
  }

  return chunks
    .map((chunk, index) => {
      return `[Source ${index + 1}: ${sourceLabel(chunk)}]\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}

export async function retrieveMaterialContext(params: {
  userId: string;
  sessionId: string;
  query: string;
  documentIds?: string[];
}): Promise<RagContext> {
  const allowed = await selectReadyOwnedMaterialIds(params.userId, params.documentIds);
  if (allowed.length === 0) return { chunks: [], sources: [] };
  const queryEmbedding = await generateEmbedding(params.query, "RETRIEVAL_QUERY", { userId: params.userId });
  const sessionChunks = await searchMaterialEmbeddings({
    userId: params.userId,
    sessionId: params.documentIds === undefined ? params.sessionId : undefined,
    queryEmbedding, limit: 5, documentIds: allowed,
  });
  let chunks = sessionChunks.filter((chunk) => chunk.score >= MIN_RELEVANCE_SCORE);
  let generalChunks: RetrievedMaterialChunk[] = [];
  if (chunks.length === 0) {
    generalChunks = await searchMaterialEmbeddings({ userId: params.userId, queryEmbedding, limit: 5, documentIds: allowed });
    chunks = generalChunks.filter((chunk) => chunk.score >= MIN_RELEVANCE_SCORE);
  }
  if (chunks.length === 0) chunks = sessionChunks.length > 0 ? sessionChunks : generalChunks;
  // Recheck SQL after search so stale/deleted/foreign index hits never enter a prompt.
  const current = new Set(await selectReadyOwnedMaterialIds(params.userId, [...new Set(chunks.map((chunk) => chunk.documentId))]));
  chunks = chunks.filter((chunk) => chunk.userId === params.userId && current.has(chunk.documentId) && allowed.includes(chunk.documentId));

  return {
    chunks,
    sources: uniqueSources(chunks),
  };
}
