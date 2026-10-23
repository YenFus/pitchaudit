import Link from "next/link";
import { Logo } from "@/components/Logo";
import { config } from "@/lib/config";

/** Where people reach the maintainers: the project's issue tracker. */
export function ContactLine() {
  return (
    <a className="text-ink underline underline-offset-2" href={`${config.repoUrl}/issues`}>
      the project&apos;s GitHub issues
    </a>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-20">
      <div className="py-5">
        <Link href="/" aria-label="Back to the home page">
          <Logo size={20} />
        </Link>
      </div>
      <h1 className="mt-8 font-serif text-4xl font-semibold text-ink">{title}</h1>
      <p className="pa-eyebrow mt-2">Last updated {updated}</p>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink-2 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <nav className="mt-12 flex gap-6 border-t-2 border-ink pt-4 text-sm text-muted">
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
      </nav>
    </main>
  );
}
