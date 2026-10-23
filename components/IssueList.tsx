import {
  CATEGORY_LABELS,
  type CategoryId,
  type Issue,
  type Severity,
} from "@/lib/types";

const SEVERITY = {
  critical: { label: "Critical", tone: "text-bad border-bad/40 bg-bad/10" },
  warning: { label: "Warning", tone: "text-warn border-warn/40 bg-warn/10" },
  info: { label: "Note", tone: "text-info border-info/30 bg-info/10" },
} as const satisfies Record<Severity, { label: string; tone: string }>;

export function SeverityPill({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return (
    <span
      className={`pa-eyebrow inline-block w-[4.6rem] shrink-0 rounded-sm border px-1.5 py-0.5 text-center !text-[0.625rem] ${s.tone}`}
    >
      {s.label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="pa-eyebrow mb-1">{label}</p>
      {children}
    </div>
  );
}

export function IssueCard({
  issue,
  open = false,
}: {
  issue: Issue;
  open?: boolean;
}) {
  return (
    <details className="group border-t border-rule first:border-t-0" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 pr-1 [&::-webkit-details-marker]:hidden">
        <SeverityPill severity={issue.severity} />
        <span className="flex-1 font-medium text-ink">{issue.title}</span>
        <span
          aria-hidden="true"
          className="pa-noprint font-mono text-lg leading-none text-faint group-open:hidden"
        >
          +
        </span>
        <span
          aria-hidden="true"
          className="pa-noprint hidden font-mono text-lg leading-none text-faint group-open:inline"
        >
          −
        </span>
      </summary>
      <div className="space-y-4 pb-5 pl-[5.35rem] pr-1 text-[0.95rem]">
        <Field label="What we found">
          <p className="text-ink-2">
            {issue.finding.charAt(0).toUpperCase() + issue.finding.slice(1)}.
          </p>
        </Field>
        {issue.evidence && issue.evidence.length > 0 && (
          <Field label="What we saw on the page">
            <div className="pa-evidence space-y-0.5">
              {issue.evidence.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </Field>
        )}
        <Field label="Why it matters">
          <p className="text-ink-2">{issue.impact}</p>
        </Field>
        <Field label="The fix">
          <p className="text-ink-2">{issue.fix}</p>
        </Field>
      </div>
    </details>
  );
}

const CATEGORY_ORDER: CategoryId[] = [
  "seo",
  "strategy",
  "mobile",
  "performance",
  "accessibility",
  "security",
];

export function IssueList({
  issues,
  openFirst = false,
}: {
  issues: Issue[];
  openFirst?: boolean;
}) {
  const grouped = CATEGORY_ORDER.map((id) => ({
    id,
    items: issues.filter((i) => i.category === id),
  })).filter((g) => g.items.length > 0);


  return (
    <div className="space-y-9">
      {grouped.map((group, gi) => (
        <section key={group.id}>
          <h3 className="pa-eyebrow mb-1 border-b border-ink pb-2 !text-ink">
            {CATEGORY_LABELS[group.id]}
          </h3>
          <div>
            {group.items.map((issue, i) => (
              <IssueCard
                key={`${issue.id}-${i}`}
                issue={issue}
                open={openFirst && gi === 0 && i === 0}
              />
            ))}
          </div>
        </section>
      ))}

    </div>
  );
}
