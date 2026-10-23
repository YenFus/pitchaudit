import { GRADE_COLORS, type CategoryResult } from "@/lib/types";

/** Six categories, laid out like the scoring block on a form. */
export function ScoreTable({
  categories,
  single = false,
}: {
  categories: CategoryResult[];
  /** Force one column (for narrow containers such as the landing sample). */
  single?: boolean;
}) {
  return (
    <dl className={`grid gap-x-12 ${single ? "" : "md:grid-cols-2"}`}>
      {categories.map((c) => {
        const measured = c.measured !== false;
        const color = GRADE_COLORS[c.grade];
        return (
          <div
            key={c.id}
            className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 border-b border-rule py-3 break-inside-avoid"
          >
            <dt className="text-sm font-medium text-ink-2">{c.label}</dt>
            <dd className="contents">
              <div
                className={`h-2 overflow-hidden rounded-sm ${
                  measured ? "bg-sunken" : "pa-hatch"
                }`}
                title={
                  measured
                    ? undefined
                    : "Google's Lighthouse didn't run, so this can't be measured"
                }
              >
                {measured && (
                  <div
                    className="h-full rounded-sm"
                    style={{ width: `${c.score}%`, backgroundColor: color }}
                  />
                )}
              </div>
              {measured ? (
                <span className="text-right font-mono text-sm text-ink">
                  <span className="font-semibold" style={{ color }}>
                    {c.grade}
                  </span>{" "}
                  <span className="text-muted">{c.score}</span>
                </span>
              ) : (
                <span className="text-right text-xs italic text-faint">
                  not measured
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
