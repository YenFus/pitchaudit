/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import dns from "node:dns/promises";
import {
  assertSafePublicHost,
  InvalidUrlError,
  UnreachableError,
} from "@/lib/audit/ssrf";
import { safeFetch } from "@/lib/audit/checks";
import { normalizeUrl } from "@/lib/audit/engine";
import * as transport from "@/lib/audit/transport";

vi.mock("@/lib/audit/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit/transport")>()),
  guardedRequest: vi.fn(),
}));

describe("SSRF & DNS Rebinding Defenses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks hostnames that resolve to internal or private IPs via DNS", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValueOnce([
      { address: "169.254.169.254", family: 4 },
    ] as any);

    await expect(assertSafePublicHost("metadata-leak.com")).rejects.toThrow(
      InvalidUrlError
    );
  });

  it("blocks hostnames that resolve to loopback 127.0.0.1", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValueOnce([
      { address: "127.0.0.1", family: 4 },
    ] as any);

    await expect(assertSafePublicHost("local-rebinding.com")).rejects.toThrow(
      InvalidUrlError
    );
  });

  it("allows hostnames that resolve to verified public IPs", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
    ] as any);

    await expect(assertSafePublicHost("example.com")).resolves.toBeUndefined();
  });

  it("detects and blocks SSRF via HTTP 302 redirects in safeFetch", async () => {
    // Initial fetch to attacker.com (public IP) returns 302 redirecting to internal metadata
    vi.spyOn(dns, "lookup")
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as any) // attacker.com
      .mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }] as any); // metadata.internal

    vi.mocked(transport.guardedRequest).mockResolvedValueOnce({
      status: 302,
      headers: new Headers({
        location: "http://169.254.169.254/latest/meta-data/",
      }),
    } as any);

    await expect(
      safeFetch("https://attacker.com/redirect-ssrf")
    ).rejects.toThrow(InvalidUrlError);
  });

  it("prevents excessive redirect loops", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as any);

    vi.mocked(transport.guardedRequest).mockResolvedValue({
      status: 302,
      headers: new Headers({ location: "https://example.com/loop" }),
    } as any);

    await expect(
      safeFetch("https://example.com/loop", { maxRedirects: 2 })
    ).rejects.toThrow(UnreachableError);
  });

  it.each([
    ["an SSH port", "https://example.com:22/"],
    ["a database port", "http://example.com:5432/"],
    ["embedded credentials", "https://user:secret@example.com/"],
  ])("refuses addresses with %s", (_label, url) => {
    expect(() => normalizeUrl(url)).toThrow(InvalidUrlError);
  });

  it("allows standard ports", () => {
    expect(normalizeUrl("https://example.com:443/")).toBe("https://example.com/");
    expect(normalizeUrl("http://example.com:80/x")).toBe("http://example.com/x");
  });

  it("blocks a redirect to a non-standard port", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
    vi.mocked(transport.guardedRequest).mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "http://example.com:6379/" }),
    } as any);
    await expect(safeFetch("https://example.com/")).rejects.toThrow(InvalidUrlError);
  });
});
