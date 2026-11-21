/** Missing measurements remain unavailable; a measured zero remains zero. */
export function metricNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function metricCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, count]) => {
    const parsed = metricNumber(count);
    return parsed !== null && parsed >= 0 ? [[key, parsed]] : [];
  }));
}
