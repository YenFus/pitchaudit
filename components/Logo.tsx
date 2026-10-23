import { config } from "@/lib/config";

/** A ticked box: the mark of an inspection form. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="2"
        stroke="var(--color-ink)"
        strokeWidth="1.75"
      />
      <path
        d="M7 12.6l3.4 3.5L17.4 8"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <LogoMark size={size} />
      <span
        className="font-serif font-semibold leading-none tracking-tight"
        style={{ fontSize: size * 0.95 }}
      >
        {config.appName}
      </span>
    </span>
  );
}
