// Grade badge SVG — the free viral loop. Embeds link back to the report
// page, so every badge on someone's site is an inbound funnel.
// Never returns a broken image: any failure yields a neutral badge.

import { normalizeUrl, runAudit } from "@/lib/audit/engine";
import { config } from "@/lib/config";
import { rateAllowAsync, requestIp } from "@/lib/ratelimit";
import { GRADE_COLORS, type Grade } from "@/lib/types";

export const maxDuration = 60;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeSvg(label: string, grade?: Grade): string {
  const name = config.appName;
  const nameWidth = 12 + name.length * 7.2;
  const labelWidth = 14 + label.length * 6.6;
  const gradeWidth = 28;
  const width = Math.round(nameWidth + labelWidth + gradeWidth);
  const gradeColor = grade ? GRADE_COLORS[grade] : "#8f8878";
  const gradeText = grade ?? "?";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${esc(
    name
  )}: ${esc(label)} grade ${gradeText}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="27" rx="3" fill="#fbf9f3" stroke="#bdb59f"/>
  <rect x="${width - gradeWidth}" width="${gradeWidth}" height="28" rx="3" fill="${gradeColor}"/>
  <rect x="${width - gradeWidth}" width="6" height="28" fill="${gradeColor}"/>
  <g font-family="ui-sans-serif,system-ui,sans-serif" font-size="12">
    <text x="10" y="18" fill="#b5341a" font-weight="700">${esc(name)}</text>
    <text x="${nameWidth + 4}" y="18" fill="#1b1813">${esc(label)}</text>
    <text x="${width - gradeWidth / 2}" y="19" fill="#ffffff" font-weight="800" font-size="14" text-anchor="middle">${gradeText}</text>
  </g>
</svg>`;
}

function respond(svg: string, cacheable: boolean): Response {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": cacheable
        ? "public, s-maxage=86400, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";

  let normalized: string;
  try {
    normalized = normalizeUrl(raw);
  } catch {
    return respond(badgeSvg("audit me"), false);
  }
  const domain = new URL(normalized).hostname.replace(/^www\./, "");

  const limit = config.limits.rateLimit;
  if (!(await rateAllowAsync(`badge:${requestIp(req)}`, limit.n, limit.windowMin))) {
    return respond(badgeSvg(domain), false);
  }

  try {
    const result = await runAudit(normalized);
    // A provisional grade (Lighthouse didn't run) isn't fit to publish on
    // someone's website, so it gets the neutral badge and is not cached.
    if (result.overall.provisional) return respond(badgeSvg(domain), false);
    return respond(badgeSvg(domain, result.overall.grade), true);
  } catch {
    return respond(badgeSvg(domain), false);
  }
}
