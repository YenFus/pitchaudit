// Single source of truth for branding and limits.

export const config = {
  appName: "PitchAudit",
  tagline: "Audit a website. Send the report.",
  description:
    "Paste a business's website and get a plain-English audit with the evidence behind every finding, your name on it, and an email ready to send. Free and open source.",
  domain: process.env.NEXT_PUBLIC_DOMAIN || "pitchaudit.vercel.app",
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/YenFus/pitchaudit",
  accentDefault: "#b5341a",
  limits: {
    bulkMax: 25,
    /** Audits per IP per window. Must allow one full bulk run. */
    rateLimit: { n: 40, windowMin: 10 },
  },
};

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `https://${config.domain}`;
}
