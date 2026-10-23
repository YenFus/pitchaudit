import type { Brand } from "@/lib/brand";
import { Logo } from "./Logo";

/** Top of the document: your brand if you've set one, ours otherwise. */
export function ReportHeader({
  brand,
  date,
}: {
  brand: Brand | null;
  date: string;
}) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="flex items-center gap-3">
        {brand?.name ? (
          <>
            {brand.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                className="h-10 w-10 rounded-sm object-contain"
              />
            )}
            <div>
              <p className="font-serif text-xl font-semibold leading-tight text-ink">
                {brand.name}
              </p>
              <p className="pa-eyebrow mt-0.5">Website audit</p>
            </div>
          </>
        ) : (
          <div>
            <Logo size={22} />
            <p className="pa-eyebrow mt-1">Website audit</p>
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="pa-eyebrow">{date}</p>
        {brand?.contact && (
          // "email · phone" reads best one part per line, and never breaks mid-number.
          <p className="mt-1 text-sm text-ink-2">
            {brand.contact
              .split(/\s*[·|•]\s*|\n/)
              .filter(Boolean)
              .map((part, i) => (
                <span key={i} className="block break-words">
                  {part}
                </span>
              ))}
          </p>
        )}
      </div>
    </header>
  );
}
