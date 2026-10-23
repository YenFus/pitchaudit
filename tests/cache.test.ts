import { describe, it, expect, beforeEach } from "vitest";
import { cacheGet, cacheSet } from "@/lib/cache";

describe("In-Memory TTL Cache", () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __paCache?: Map<string, unknown> };
    g.__paCache?.clear();
  });

  it("stores and retrieves values within TTL", () => {
    cacheSet("key1", { data: "test" }, 5000);
    const retrieved = cacheGet<{ data: string }>("key1");
    expect(retrieved).toEqual({ data: "test" });
  });

  it("returns undefined for expired items", () => {
    cacheSet("expired", "value", -100); // already expired
    const retrieved = cacheGet<string>("expired");
    expect(retrieved).toBeUndefined();
  });

  it("returns undefined for non-existent keys", () => {
    expect(cacheGet("nonexistent")).toBeUndefined();
  });
});
