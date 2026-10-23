import { beforeAll, describe, it, expect, vi } from "vitest";
import { config } from "@/lib/config";

// Rate-limit behaviour of /api/audit, with the audit itself stubbed out so no
// network is touched.
vi.mock("@/lib/audit/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/audit/engine")>();
  return {
    ...real,
    runAudit: async (url: string) => ({
      url,
      finalUrl: url,
      fetchedAt: new Date().toISOString(),
      overall: { score: 80, grade: "B", verdict: "ok" },
      categories: [],
      issues: Array.from({ length: 6 }, (_, i) => ({
        id: `x${i}`,
        category: "seo",
        severity: "warning",
        title: `t${i}`,
        finding: "f",
        impact: "i",
        fix: "x",
        evidence: [`evidence-${i}`],
      })),
      pageMeta: {},
    }),
  };
});

import { POST as auditPost } from "@/app/api/audit/route";

let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

function audit(ip: string, site = "example.com") {
  return auditPost(
    new Request("http://localhost/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": ip },
      body: JSON.stringify({ url: `https://${site}` }),
    })
  );
}

describe("/api/audit rate limits", () => {
  // These requests carry X-Real-IP, so behave as if behind a trusted proxy.
  beforeAll(() => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
  });

  it("lets one person bulk-audit the advertised maximum in one go", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < config.limits.bulkMax; i++) {
      statuses.push((await audit(ip, `site${i}.example.com`)).status);
    }
    expect(statuses.filter((s) => s !== 200)).toEqual([]);
  });

  it("caps each IP at the configured limit", async () => {
    const ip = freshIp();
    for (let i = 0; i < config.limits.rateLimit.n; i++) {
      expect((await audit(ip)).status).toBe(200);
    }
    expect((await audit(ip)).status).toBe(429);
  });

  it("returns every finding, with its evidence, to everyone", async () => {
    const body = (await (await audit(freshIp())).json()) as {
      issues: { evidence?: string[] }[];
    };
    expect(body.issues).toHaveLength(6);
    expect(body.issues[5].evidence?.[0]).toBe("evidence-5");
  });

  it("limits are per client IP", async () => {
    const a = freshIp();
    const b = freshIp();
    for (let i = 0; i < config.limits.rateLimit.n; i++) await audit(a);
    expect((await audit(a)).status).toBe(429);
    expect((await audit(b)).status).toBe(200);
  });
});
