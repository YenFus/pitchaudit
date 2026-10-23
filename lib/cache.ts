// Bounded TTL cache with Upstash Redis distributed backing and local in-memory fallback.

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 500;

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

/** Distributed async cache getter via Upstash Redis REST when available */
export async function cacheGetAsync<T>(key: string): Promise<T | undefined> {
  const local = cacheGet<T>(key);
  if (local !== undefined) return local;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;

  try {
    const res = await fetch(`${url}/get/pa:cache:${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { result: string | null };
    if (!data.result) return undefined;
    const parsed = JSON.parse(data.result) as T;
    // Cache locally for fast subsequent reads
    cacheSet(key, parsed, 60_000);
    return parsed;
  } catch {
    return undefined;
  }
}

/** Distributed async cache setter via Upstash Redis REST when available */
export async function cacheSetAsync<T>(
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  // Always update local cache
  cacheSet(key, value, ttlMs);

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  try {
    const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
    await fetch(`${url}/set/pa:cache:${encodeURIComponent(key)}?ex=${ttlSec}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Non-blocking error
  }
}
