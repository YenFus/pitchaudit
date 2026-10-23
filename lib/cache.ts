// Small in-memory TTL cache. Re-opening a report within the hour reuses the
// audit instead of running Lighthouse again.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 200;

function store(): Map<string, Entry<unknown>> {
  const g = globalThis as unknown as { __paCache?: Map<string, Entry<unknown>> };
  if (!g.__paCache) g.__paCache = new Map();
  return g.__paCache;
}

export function cacheGet<T>(key: string): T | undefined {
  const s = store();
  const entry = s.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    s.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const s = store();
  if (s.size >= MAX_ENTRIES && !s.has(key)) {
    const oldest = s.keys().next().value;
    if (oldest !== undefined) s.delete(oldest);
  }
  s.set(key, { value, expiresAt: Date.now() + ttlMs });
}
