import { GRADE_COLORS, type Grade } from "@/lib/types";

const SIZES = {
  sm: { box: 56, letter: 34, score: 9 },
  md: { box: 84, letter: 54, score: 11 },
  lg: { box: 112, letter: 74, score: 12 },
} as const;

/** The overall grade, stamped onto the page like an inspector's mark. */
export function GradeStamp({
  grade,
  score,
  size = "lg",
  provisional = false,
  tilt = false,
}: {
  grade: Grade;
  score: number;
  size?: keyof typeof SIZES;
  /** Lighthouse didn't run, so this grade covers only what we could measure. */
  provisional?: boolean;
  tilt?: boolean;
}) {
  const s = SIZES[size];
  return (
    <div
      className="inline-flex flex-col items-center gap-1.5"
      role="img"
      aria-label={`Overall grade ${grade}, ${score} out of 100${
        provisional ? ", provisional" : ""
      }`}
    >
      <div
        className="pa-stamp"
        style={{
          width: s.box,
          height: s.box,
          color: GRADE_COLORS[grade],
          borderStyle: provisional ? "dashed" : "solid",
          transform: tilt ? "rotate(-3deg)" : undefined,
        }}
      >
        <span
          className="font-semibold"
          style={{ fontSize: s.letter, marginTop: -s.letter * 0.06 }}
        >
          {grade}
        </span>
        <span
          className="font-mono font-medium"
          style={{ fontSize: s.score, marginTop: s.box * 0.02 }}
        >
          {score}/100
        </span>
      </div>
      {provisional && (
        <span className="pa-eyebrow !text-[0.625rem] text-warn">Provisional</span>
      )}
    </div>
  );
}
