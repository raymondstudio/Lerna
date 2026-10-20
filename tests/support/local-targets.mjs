/** Reject every nonlocal target before a fixture can read credentials or connect. */
export function localTarget(value, label) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(`BLOCKED: ${label} must be a loopback origin.`);
  return url.origin;
}
export function localTargets(env = process.env) {
  if (env.LERNA_TEST_MODE !== 'local') throw new Error('BLOCKED: fixture execution requires LERNA_TEST_MODE=local.');
  const backend = localTarget(env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321', 'Auth/backend');
  if (env.NEXT_PUBLIC_SUPABASE_DATA_API_URL) localTarget(env.NEXT_PUBLIC_SUPABASE_DATA_API_URL, 'Data API');
  return { backend, app: localTarget(env.LERNA_E2E_BASE_URL ?? 'http://127.0.0.1:3100', 'App'), search: localTarget(env.ELASTICSEARCH_URL ?? 'http://127.0.0.1:9200', 'Search'), mailbox: localTarget(env.LERNA_MAILBOX_URL ?? 'http://127.0.0.1:54324', 'Mailbox') };
}
