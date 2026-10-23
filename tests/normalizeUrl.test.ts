import { describe, it, expect } from "vitest";
import { normalizeUrl, isPrivateIp, isPrivateHost, InvalidUrlError } from "@/lib/audit/engine";

describe("normalizeUrl and SSRF guards", () => {
  it("normalizes valid URLs with and without schemes", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
    expect(normalizeUrl("https://example.com/test")).toBe("https://example.com/test");
    expect(normalizeUrl("http://acme.org:80/path")).toBe("http://acme.org/path");
    // Non-standard ports are refused so the auditor can't probe other services.
    expect(() => normalizeUrl("http://acme.org:8080/path")).toThrow(InvalidUrlError);
    expect(normalizeUrl("  https://my-site.co.uk  ")).toBe("https://my-site.co.uk/");
  });

  it("rejects non-http/https protocols", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("file:///etc/passwd")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("data:text/html,<h1>hi</h1>")).toThrow(InvalidUrlError);
  });

  it("rejects empty or whitespace-only inputs", () => {
    expect(() => normalizeUrl("")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("   ")).toThrow(InvalidUrlError);
  });

  it("identifies private IPv4 addresses correctly", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.10.20.30")).toBe(true);
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.254.254.254")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("100.64.0.1")).toBe(true); // CGNAT
    expect(isPrivateIp("224.0.0.1")).toBe(true); // Multicast
    expect(isPrivateIp("240.0.0.1")).toBe(true); // Reserved

    // Public IPs should pass
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("142.250.190.46")).toBe(false);
  });

  it("identifies private IPv6 addresses correctly", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.0.1")).toBe(true);

    // Public IPv6 should pass
    expect(isPrivateIp("2607:f8b0:4005:805::200e")).toBe(false);
  });

  it("rejects private hostnames and local domains", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("router.local")).toBe(true);
    expect(isPrivateHost("db.internal")).toBe(true);
    expect(isPrivateHost("site.localhost")).toBe(true);
    expect(isPrivateHost("hidden.onion")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);

    expect(() => normalizeUrl("http://localhost:3000")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("http://127.0.0.1/admin")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("http://169.254.169.254/latest/meta-data")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("http://192.168.1.1/setup")).toThrow(InvalidUrlError);
    expect(() => normalizeUrl("http://internal-service.local")).toThrow(InvalidUrlError);
  });

  it("rejects hostnames without dots (unless localhost which is blocked anyway)", () => {
    expect(() => normalizeUrl("http://singleword")).toThrow(InvalidUrlError);
  });
});
