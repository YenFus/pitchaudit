import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as badgeGet } from "@/app/api/badge/route";
import { POST as auditPost } from "@/app/api/audit/route";

describe("API Route Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("/api/badge", () => {
    it("returns a valid SVG image without crashing on empty or invalid URL", async () => {
      const req = new Request("http://localhost/api/badge?url=");
      const res = await badgeGet(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      const svg = await res.text();
      expect(svg).toContain("<svg");
      expect(svg).toContain("audit me");
    });
  });

  describe("/api/audit", () => {
    it("returns 400 for empty or invalid URL", async () => {
      const req = new Request("http://localhost/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });

      const res = await auditPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("returns 400 when attempting to audit private or local addresses (SSRF guard)", async () => {
      const req = new Request("http://localhost/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://127.0.0.1:8080" }),
      });

      const res = await auditPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Private and local addresses");
    });
  });
});
