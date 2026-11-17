import { env } from "../env";

type ElasticDocument = Record<string, unknown>;
type ElasticHit = { _source: ElasticDocument; _score: number };
type ElasticResponse = Record<string, unknown> & { hits?: { hits?: ElasticHit[] } };
type ElasticFilter = { term?: Record<string, unknown>; terms?: Record<string, unknown[]>; match?: Record<string, unknown>; bool?: { should?: ElasticFilter[] } };
type ElasticQuery = { query?: { bool?: { filter?: ElasticFilter[] } }; knn?: { filter?: ElasticFilter | ElasticFilter[]; query_vector?: number[]; k?: number } };
const globalMock = globalThis as typeof globalThis & { _mockElasticIndices?: Record<string, Record<string, ElasticDocument>> };
const mockIndices = globalMock._mockElasticIndices ??= {};

function explicitMockMode() { return process.env.NODE_ENV === "test" && process.env.LERNA_ELASTIC_MODE === "mock"; }
class ElasticRequestError extends Error {
  constructor(public readonly status: number) { super("Search service request failed."); }
}
function getEndpoint() { return env.ELASTICSEARCH_URL || ""; }
function getApiKey() { return env.ELASTICSEARCH_API_KEY ?? env.ELASTIC_SEARCH_API_KEY ?? ""; }
function authHeader() { return `ApiKey ${getApiKey()}`; }
function isDocument(value: unknown): value is ElasticDocument { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function numberArray(value: unknown): value is number[] { return Array.isArray(value) && value.every(item => typeof item === "number" && Number.isFinite(item)); }
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}
function fixtureBody(init: RequestInit): ElasticDocument {
  const value: unknown = JSON.parse(typeof init.body === "string" ? init.body : "{}");
  if (!isDocument(value)) throw new Error("Invalid search fixture body.");
  return value;
}
function field(document: ElasticDocument, key: string) {
  const clean = key.replace(".keyword", "");
  return document[clean] ?? document[clean.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] ?? document[clean.replace(/([A-Z])/g, "_$1").toLowerCase()];
}
function matchesFilter(document: ElasticDocument, filter: ElasticFilter): boolean {
  if (filter.term || filter.match) {
    const entry = Object.entries(filter.term ?? filter.match ?? {})[0];
    return Boolean(entry && field(document, entry[0]) === entry[1]);
  }
  if (filter.terms) {
    const entry = Object.entries(filter.terms)[0];
    return Boolean(entry && Array.isArray(entry[1]) && entry[1].includes(field(document, entry[0])));
  }
  return filter.bool?.should?.some(item => matchesFilter(document, item)) ?? true;
}
/** Fixtures are reachable only in the explicit local test mode. */
function mockElasticRequest(path: string, init: RequestInit = {}): ElasticResponse {
  const method = init.method?.toUpperCase() ?? "GET";
  const decoded = decodeURIComponent(path), [index, action, documentId] = decoded.split("/");
  if (method === "HEAD") {
    if (!mockIndices[index]) throw new ElasticRequestError(404);
    return {};
  }
  if (method === "PUT") {
    mockIndices[index] ??= {};
    if (action === "_doc" && documentId) mockIndices[index][documentId] = fixtureBody(init);
    return { acknowledged: true };
  }
  if (method === "POST" && decoded.includes("_refresh")) return { _shards: { total: 1, successful: 1, failed: 0 } };
  if (method === "POST" && (decoded.includes("_search") || decoded.includes("_delete_by_query"))) {
    const body = fixtureBody(init) as ElasticQuery;
    const filters = [...(body.query?.bool?.filter ?? []), ...(Array.isArray(body.knn?.filter) ? body.knn.filter : body.knn?.filter ? [body.knn.filter] : [])];
    const documents = mockIndices[index] ?? {};
    const entries = Object.entries(documents).filter(([, document]) => filters.every(filter => matchesFilter(document, filter)));
    if (decoded.includes("_delete_by_query")) {
      entries.forEach(([id]) => { delete documents[id]; });
      return { deleted: entries.length };
    }
    const hits = entries.map(([, document]) => ({ _source: document, _score: numberArray(body.knn?.query_vector) && numberArray(document.embedding) ? cosineSimilarity(body.knn.query_vector, document.embedding) : 1 }));
    hits.sort((a, b) => b._score - a._score);
    return { hits: { hits: body.knn ? hits.slice(0, body.knn.k ?? 5) : hits } };
  }
  if (method === "POST" && path === "_bulk") {
    const lines = (typeof init.body === "string" ? init.body : "").split("\n").filter(Boolean);
    for (let i = 0; i < lines.length; i += 2) {
      const action: unknown = JSON.parse(lines[i]), document: unknown = JSON.parse(lines[i + 1]);
      if (!isDocument(action) || !isDocument(action.index) || typeof action.index._index !== "string" || !isDocument(document)) throw new Error("Invalid bulk search fixture.");
      const destination = mockIndices[action.index._index] ??= {};
      const id = typeof document.id === "string" ? document.id : typeof document.chunk_id === "string" ? document.chunk_id : crypto.randomUUID();
      destination[id] = document;
    }
    return { errors: false, items: [] };
  }
  return {};
}

async function elasticRequest(path: string, init: RequestInit = {}): Promise<ElasticResponse> {
  if (explicitMockMode()) return mockElasticRequest(path, init);
  const endpoint = getEndpoint(), apiKey = getApiKey();
  if (!endpoint || !apiKey) throw new Error("Search service is not configured.");
  const origin = new URL(endpoint);
  if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("Search service requires a trusted HTTPS endpoint.");
  const response = await fetch(`${endpoint.replace(/\/+$/g, "")}/${path.replace(/^\/+/, "")}`, {
    ...init, redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", Authorization: authHeader(), ...(init.headers ?? {}) },
  });
  if (!response.ok) { await response.body?.cancel(); throw new ElasticRequestError(response.status); }
  if (init.method === "HEAD" || response.status === 204) return {};
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2 * 1024 * 1024) { await reader.cancel(); throw new Error("Search service response exceeds the supported limit."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result: unknown = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  if (!isDocument(result)) throw new Error("Search service returned an invalid response.");
  if (result?.errors === true || (Array.isArray(result?.failures) && result.failures.length > 0) || result?.timed_out === true) {
    throw new Error("Search service could not complete the operation.");
  }
  return result as ElasticResponse;
}

export async function searchIndex(index: string, body: unknown) {
  return elasticRequest(`${encodeURIComponent(index)}/_search`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createIndexIfMissing(index: string, body: unknown, signal?: AbortSignal) {
  const encodedIndex = encodeURIComponent(index);

  try {
    await elasticRequest(encodedIndex, { method: "HEAD", signal });
    return;
  } catch (error) {
    if (!(error instanceof ElasticRequestError && error.status === 404) && !explicitMockMode()) throw error;
    await elasticRequest(encodedIndex, {
      method: "PUT", signal,
      body: JSON.stringify(body),
    });
  }
}

export async function indexDocument(index: string, id: string, body: unknown, signal?: AbortSignal) {
  return elasticRequest(`${encodeURIComponent(index)}/_doc/${encodeURIComponent(id)}`, {
    method: "PUT", signal,
    body: JSON.stringify(body),
  });
}

export async function deleteByQuery(index: string, body: unknown, signal?: AbortSignal) {
  return elasticRequest(`${encodeURIComponent(index)}/_delete_by_query?conflicts=proceed&refresh=true`, {
    method: "POST", signal,
    body: JSON.stringify(body),
  });
}

export async function refreshIndex(index: string, signal?: AbortSignal) {
  return elasticRequest(`${encodeURIComponent(index)}/_refresh`, {
    method: "POST", signal,
  });
}

export async function indexDocumentChunks(
  index: string,
  chunks: Array<{ text: string; embedding: number[]; sessionId: string }>
) {
  let body = "";
  for (const chunk of chunks) {
    body += JSON.stringify({ index: { _index: index } }) + "\n";
    body += JSON.stringify(chunk) + "\n";
  }

  return elasticRequest("_bulk", { method: "POST", headers: { "Content-Type": "application/x-ndjson" }, body });
}

export async function searchSimilarChunks(index: string, sessionId: string, embedding: number[], limit = 3) {
  const query = {
    knn: {
      field: "embedding",
      query_vector: embedding,
      k: limit,
      num_candidates: 50,
      filter: {
        bool: {
          should: [
            { term: { session_id: sessionId } },
            { term: { "session_id.keyword": sessionId } },
            { match: { session_id: sessionId } },
            { term: { sessionId: sessionId } },
            { term: { "sessionId.keyword": sessionId } }
          ],
          minimum_should_match: 1
        }
      }
    },
    _source: ["chunk_text", "text"]
  };

  const res = await searchIndex(index, query);
  return res.hits?.hits?.map(hit => hit._source.chunk_text ?? hit._source.text).filter((text): text is string => typeof text === "string" && Boolean(text)) ?? [];
}
