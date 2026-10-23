// Composes direct checks + Lighthouse + copy + scoring into a full
// AuditResult. Used by the audit API route.

import { cacheGet, cacheSet } from "../cache";
import type { AuditResult, Issue } from "../types";
import { sortIssues } from "../types";
import { runChecks } from "./checks";
import { IMPACT_COPY, psiFallbackCopy } from "./impact-copy";
import { runLighthouse } from "./lighthouse";
import { computeScores } from "./score";

import {
  assertAllowedUrl,
  assertSafePublicHost,
  InvalidUrlError,
  isPrivateHost,
  isPrivateIp,
  UnreachableError,
} from "./ssrf";

export {
  assertSafePublicHost,
  InvalidUrlError,
  isPrivateHost,
  isPrivateIp,
  UnreachableError,
};

const CACHE_TTL_MS = 60 * 60 * 1000;


/** Normalize user input to a fetchable, SSRF-safe http(s) URL. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidUrlError("Please enter a website address.");
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError("That doesn't look like a valid website address.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new InvalidUrlError("Only http(s) websites can be audited.");
  }
  const host = parsed.hostname.toLowerCase();
  if (isPrivateHost(host)) {
    throw new InvalidUrlError("Private and local addresses can't be audited.");
  }
  if (!host.includes(".") && host !== "localhost") {
    throw new InvalidUrlError("That doesn't look like a valid website address.");
  }
  assertAllowedUrl(parsed);
  return parsed.toString();
}


export async function runAudit(normalizedUrl: string): Promise<AuditResult> {
  const cached = cacheGet<AuditResult>(`audit:${normalizedUrl}`);
  if (cached) return cached;

  await assertSafePublicHost(new URL(normalizedUrl).hostname);

  const [checks, psi] = await Promise.all([
    runChecks(normalizedUrl),
    runLighthouse(normalizedUrl),
  ]);

  const issues: Issue[] = [];

  for (const raw of checks.issues) {
    const copy = IMPACT_COPY[raw.id];
    if (!copy) continue;
    issues.push({
      id: raw.id,
      category: copy.category,
      severity: raw.severity,
      title: copy.title,
      finding: raw.finding,
      impact: copy.impact,
      fix: copy.fix,
      evidence: raw.evidence,
      pitch: copy.pitch?.(raw) || undefined,
    });
  }

  for (const opp of psi.mobile?.opportunities ?? []) {
    const copy = IMPACT_COPY[opp.id] ?? psiFallbackCopy(opp.title, opp.description);
    issues.push({
      id: `psi:${opp.id}`,
      category: copy.category,
      severity: opp.savingsMs >= 2000 ? "critical" : "warning",
      title: copy.title,
      finding: opp.displayValue
        ? `Lighthouse measured: ${opp.displayValue}`
        : `potential saving of ${(opp.savingsMs / 1000).toFixed(1)}s per visit`,
      impact: copy.impact,
      fix: copy.fix,
      evidence: [
        `Google Lighthouse (mobile): ${opp.title}`,
        opp.displayValue ?? `Estimated saving ${(opp.savingsMs / 1000).toFixed(1)}s per visit`,
      ],
      pitch:
        opp.savingsMs >= 1000
          ? `Google's own speed test flags “${copy.title.toLowerCase()}” on the homepage${
              opp.displayValue ? ` (${opp.displayValue.toLowerCase()})` : ""
            }.`
          : undefined,
    });
  }

  const sorted = sortIssues(issues);
  const { overall, categories } = computeScores(
    sorted,
    psi.mobile,
    checks.viewportPass
  );

  const vitalsSource = psi.mobile?.fieldMetrics ?? {
    lcpMs: psi.mobile?.labVitals.lcpMs,
    cls: psi.mobile?.labVitals.cls,
  };

  const result: AuditResult = {
    url: normalizedUrl,
    finalUrl: checks.finalUrl,
    fetchedAt: new Date().toISOString(),
    overall,
    categories,
    issues: sorted,
    screenshot: psi.mobile?.screenshot,
    vitals: psi.mobile ? vitalsSource : undefined,
    lighthouseError: psi.error,
    pageMeta: checks.pageMeta,
  };

  cacheSet(`audit:${normalizedUrl}`, result, CACHE_TTL_MS);
  return result;
}
