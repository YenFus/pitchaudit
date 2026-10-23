import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Runs on localhost over plain http, so no HSTS. The page only ever talks to its own origin. Images can be data: URIs (the
// Lighthouse screenshot and your uploaded logo). Fonts are self-hosted by
// next/font. React's dev overlay needs eval, so that's allowed in dev only.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lighthouse and chrome-launcher load files at runtime; leave them unbundled.
  serverExternalPackages: ["lighthouse", "chrome-launcher"],
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
