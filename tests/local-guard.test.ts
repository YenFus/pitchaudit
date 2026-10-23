import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLocalRequest, isAllowedHost } from "@/lib/local-guard";

const req = (
  pathname: string,
  headers: Record<string, string>,
  method = "POST"
) => checkLocalRequest({ method, pathname, headers: new Headers(headers) });

const LOCAL_JSON = { host: "localhost:3000", "content-type": "application/json" };

describe("local-only guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "localhost"])(
    "accepts host %s",
    (host) => expect(isAllowedHost(host)).toBe(true)
  );

  it.each(["evil.example:3000", "192.168.1.20:3000", "localhost.evil.example", "127.0.0.1.nip.io:3000", ""])(
    "refuses host %s (DNS rebinding / LAN access)",
    (host) => {
      expect(isAllowedHost(host)).toBe(false);
      const v = req("/", { host }, "GET");
      expect(v.ok).toBe(false);
    }
  );

  it("lets you allow extra hostnames on purpose", () => {
    vi.stubEnv("PITCHAUDIT_ALLOWED_HOSTS", "audit.mybox.lan, other.lan");
    expect(isAllowedHost("audit.mybox.lan:3000")).toBe(true);
  });

  it("accepts the app's own API calls", () => {
    expect(req("/api/audit", { ...LOCAL_JSON, origin: "http://localhost:3000" }).ok).toBe(true);
    expect(req("/api/audit", { ...LOCAL_JSON, "sec-fetch-site": "same-origin" }).ok).toBe(true);
  });

  it("refuses API calls from another website open in the browser", () => {
    expect(req("/api/audit", { ...LOCAL_JSON, origin: "https://evil.example" })).toMatchObject({ ok: false, status: 403 });
    expect(req("/api/audit", { ...LOCAL_JSON, origin: "null" })).toMatchObject({ ok: false, status: 403 });
    expect(req("/api/audit", { ...LOCAL_JSON, "sec-fetch-site": "cross-site" })).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses non-JSON POSTs (the kind a cross-site form can send without asking)", () => {
    expect(req("/api/audit", { host: "localhost:3000", "content-type": "text/plain" })).toMatchObject({ ok: false, status: 415 });
    expect(req("/api/audit", { host: "localhost:3000", "content-type": "application/x-www-form-urlencoded" })).toMatchObject({ ok: false, status: 415 });
  });

  it("doesn't apply the API rules to pages", () => {
    expect(req("/report", { host: "localhost:3000", origin: "https://evil.example" }, "GET").ok).toBe(true);
  });
});
