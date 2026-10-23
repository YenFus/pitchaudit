/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { rateAllow, rateAllowAsync, requestIp } from "@/lib/ratelimit";

describe("Rate Limiting and IP resolution", () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __paRate?: Map<string, number[]> };
    g.__paRate?.clear();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.restoreAllMocks();
  });

  it("allows requests within quota and blocks when exceeded", () => {
    const ip = "198.51.100.1";
    const limit = 3;
    const windowMin = 1;

    expect(rateAllow(ip, limit, windowMin)).toBe(true); // 1
    expect(rateAllow(ip, limit, windowMin)).toBe(true); // 2
    expect(rateAllow(ip, limit, windowMin)).toBe(true); // 3
    expect(rateAllow(ip, limit, windowMin)).toBe(false); // 4 - blocked
  });

  it("isolates different IP addresses", () => {
    const ipA = "198.51.100.10";
    const ipB = "198.51.100.20";

    expect(rateAllow(ipA, 1, 5)).toBe(true);
    expect(rateAllow(ipA, 1, 5)).toBe(false); // ipA blocked

    // ipB should still be allowed
    expect(rateAllow(ipB, 1, 5)).toBe(true);
  });

  describe("requestIp trust model", () => {
    afterEach(() => vi.unstubAllEnvs());
    const req = (headers: Record<string, string> = {}) =>
      new Request("http://localhost", { headers });

    it("ignores every forwarding header by default (they can be forged)", () => {
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("TRUST_PROXY_HEADERS", "");
      expect(requestIp(req({ "x-vercel-forwarded-for": "198.51.100.77" }))).toBe("direct");
      expect(requestIp(req({ "x-real-ip": "198.51.100.8" }))).toBe("direct");
      expect(requestIp(req({ "x-forwarded-for": "198.51.100.9" }))).toBe("direct");
      expect(requestIp(req())).toBe("direct");
    });

    it("on Vercel, uses the edge-set client address", () => {
      vi.stubEnv("VERCEL", "1");
      expect(requestIp(req({ "x-vercel-forwarded-for": "198.51.100.77" }))).toBe("198.51.100.77");
      expect(requestIp(req({ "x-forwarded-for": "2001:db8::1, 10.0.0.1" }))).toBe("2001:db8::1");
    });

    it("behind a trusted proxy, uses the right-most X-Forwarded-For entry, not a forged left one", () => {
      vi.stubEnv("VERCEL", "");
      vi.stubEnv("TRUST_PROXY_HEADERS", "true");
      expect(requestIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.20" }))).toBe("198.51.100.20");
      expect(requestIp(req({ "x-real-ip": "198.51.100.21" }))).toBe("198.51.100.21");
    });

    it("rejects values that aren't IP addresses", () => {
      vi.stubEnv("VERCEL", "1");
      expect(requestIp(req({ "x-vercel-forwarded-for": "random-attacker-uuid-12345" }))).toBe("direct");
    });
  });

  it("supports Upstash Redis distributed limiting and falls back gracefully", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

    // Mock successful Redis pipeline response
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [{ result: 1 }, { result: "OK" }],
    } as any);

    const allowed = await rateAllowAsync("test-key", 5, 1);
    expect(allowed).toBe(true);

    // Mock Redis outage / network error - should fall back to memory without crashing
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Redis timeout"));
    const fallbackAllowed = await rateAllowAsync("test-key-fallback", 5, 1);
    expect(fallbackAllowed).toBe(true);
  });
});
