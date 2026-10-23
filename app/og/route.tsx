import { ImageResponse } from "next/og";
import { config } from "@/lib/config";

// The social card, drawn like the product: paper, ink, one red pen, and the
// grade stamp. (ImageResponse only ships a sans-serif, so no serif here.)
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f4f0e6",
          color: "#1b1813",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke="#1b1813" strokeWidth="1.75" />
            <path d="M7 12.6l3.4 3.5L17.4 8" stroke="#b5341a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            {config.appName}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
              maxWidth: 760,
            }}
          >
            <span>Audit a website.</span>
            <span style={{ color: "#b5341a" }}>Send the report.</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 220,
              height: 220,
              border: "6px solid #a06a00",
              color: "#a06a00",
              transform: "rotate(-4deg)",
            }}
          >
            <span style={{ fontSize: 150, fontWeight: 800, lineHeight: 1 }}>C</span>
            <span style={{ fontSize: 26, fontWeight: 600 }}>62/100</span>
          </div>
        </div>

        <div style={{ fontSize: 28, color: "#625c50", display: "flex" }}>
          Plain-English audits with the evidence behind every finding.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
