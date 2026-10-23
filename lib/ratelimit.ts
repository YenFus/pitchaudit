// Sliding-window rate limiter with Upstash Redis distributed support
// and safe in-memory fallback with LRU memory bounds.

const MAX_BUCKETS = 2000;

function buckets(): Map<string, number[]> {
  const g = globalThis as unknown as { __paRate?: Map<string, number[]> };
  if (!g.__paRate) g.__paRate = new Map();
  return g.__paRate;
}

/** Evicts expired entries and limits max memory footprint without resetting active limits */
function pruneBuckets(now: number, maxAgeMs: number): void {
  const b = buckets();
  if (b.size <= MAX_BUCKETS) return;

  for (const [key, timestamps] of b.entries()) {
    const fresh = timestamps.filter((t) => now - t < maxAgeMs);
    if (fresh.length === 0) {
      b.delete(key);
    } else {
      b.set(key, fresh);
    }
  }

  if (b.size > MAX_BUCKETS) {
    let toDelete = Math.floor(b.size * 0.2);
    for (const key of b.keys()) {
      if (toDelete <= 0) break;
      b.delete(key);
      toDelete--;
    }
  }
}

/** In-memory sliding-window check */
function inMemoryRateAllow(ip: string, n: number, windowMin: number): boolean {
  const now = Date.now();
  const windowMs = windowMin * 60_000;
  const b = buckets();

  pruneBuckets(now, windowMs);

  const hits = (b.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= n) {
    b.set(ip, hits);
    return false;
  }
  hits.push(now);
  b.set(ip, hits);
  return true;
}

/**
 * Distributed rate limiter via Upstash Redis REST API when configured,
 * falling back to local memory.
 */
export async function rateAllowAsync(
  key: string,
  n: number,
  windowMin: number
): Promise<boolean> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return inMemoryRateAllow(key, n, windowMin);
  }

  try {
    const windowSec = windowMin * 60;
    const redisKey = `pa:rl:${key}`;

    // Atomic INCR + EXPIRE via Upstash pipeline
    const res = await fetch(`${upstashUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec],
      ]),
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      return inMemoryRateAllow(key, n, windowMin);
    }

    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 1;
    return count <= n;
  } catch {
    // Fail open to local memory on Redis timeout/error
    return inMemoryRateAllow(key, n, windowMin);
  }
}

/** Synchronous rate limiter interface */
export function rateAllow(ip: string, n: number, windowMin: number): boolean {
  return inMemoryRateAllow(ip, n, windowMin);
}

/** Validate if a string is a standard IPv4 or IPv6 format */
function isValidIp(ip: string): boolean {
  // IPv4: 4 octets 0-255
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
  }
  // IPv6: hex with colons
  if (/^[0-9a-fA-F:]{2,39}$/.test(ip) && ip.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Client IP for rate limiting.
 *
 * Forwarding headers can be set by anyone, so they're only trusted when a
 * proxy we know about writes them:
 *  - On Vercel (VERCEL is set), the edge overwrites x-vercel-forwarded-for
 *    and x-forwarded-for with the real client address.
 *  - When self-hosting behind your own proxy, set TRUST_PROXY_HEADERS=true.
 *    The right-most X-Forwarded-For entry (the one your proxy appended) is
 *    used, then X-Real-IP.
 * Otherwise all requests share one bucket. That's strict, but it can't be
 * bypassed by forging a header.
 */
export function requestIp(req: Request): string {
  const h = req.headers;
  const first = (v: string | null) => v?.split(",")[0]?.trim();
  const last = (v: string | null) => v?.split(",").pop()?.trim();

  if (process.env.VERCEL) {
    for (const candidate of [first(h.get("x-vercel-forwarded-for")), first(h.get("x-forwarded-for"))]) {
      if (candidate && isValidIp(candidate)) return candidate;
    }
  } else if (process.env.TRUST_PROXY_HEADERS === "true") {
    for (const candidate of [last(h.get("x-forwarded-for")), h.get("x-real-ip")?.trim()]) {
      if (candidate && isValidIp(candidate)) return candidate;
    }
  }
  return "direct";
}
