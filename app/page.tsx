import Link from "next/link";
import { AuditForm } from "@/components/AuditForm";
import { GradeStamp } from "@/components/GradeStamp";
import { HistoryStrip } from "@/components/HistoryStrip";
import { IssueCard } from "@/components/IssueList";
import { Logo } from "@/components/Logo";
import { ReportHeader } from "@/components/ReportHeader";
import { ScoreTable } from "@/components/ScoreTable";
import { config } from "@/lib/config";
import {
  SAMPLE_BRAND,
  SAMPLE_DOMAIN,
  SAMPLE_EMAIL,
  SAMPLE_REPORT,
} from "@/lib/sample-report";

const CHECKS: { group: string; covers: string }[] = [
  {
    group: "Search visibility",
    covers: "Page title, meta description, headings, robots.txt, sitemap, noindex tags",
  },
  {
    group: "Mobile",
    covers: "Viewport, pinch-to-zoom, tap-to-call numbers, layout built on tables",
  },
  {
    group: "Speed",
    covers: "Lighthouse (run in your own Chrome), server response time, page weight",
  },
  {
    group: "Conversion basics",
    covers: "A clear next step, analytics tags, reviews on the page, social previews, copyright year",
  },
  {
    group: "Accessibility",
    covers: "Image alt text, form labels, link text, page language, landmarks",
  },
  {
    group: "Security basics",
    covers: "https, security headers, cookies, mixed content",
  },
];

const LIMITS: string[] = [
  "No backlink, keyword-ranking or traffic numbers. That needs a paid SEO database.",
  "It reads the public page. Anything behind a login, or added only after the page loads, is invisible to it.",
  "Some sites turn automated visitors away (2 of the 35 small-business sites we tried did). You get a clear message instead of a wrong report.",
  "Speed and accessibility need Google Chrome on this computer. Without it those two are marked “not measured” rather than guessed.",
  "A missing item isn't always a fault. Each finding says how much it matters and shows the evidence, so you can judge.",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Where does it run?",
    a: "Entirely on this computer. The audit fetches the website from here, and Lighthouse runs in a hidden copy of your own Chrome. There's no account and no server of ours; your branding and recent audits are kept in this browser.",
  },
  {
    q: "Does it use AI?",
    a: "No. Every check is a fixed rule, the explanations are written by hand, and the emails are templates filled in with what the audit found. The same page gives the same report every time.",
  },
  {
    q: "How accurate is it?",
    a: "Each finding shows the exact thing we saw on the page, so you can check it in seconds. Before release we ran the checks on 33 real small-business sites and compared every result with an independent check. After we fixed the mistakes that turned up, the two agreed every time. Automated audits still get things wrong (for example, reviews loaded by a script look absent), so read the evidence before you send anything.",
  },
  {
    q: "Will my client see PitchAudit?",
    a: "Not if you set up your branding. Reports then carry your name, logo and colours, and you send them as a PDF.",
  },
  {
    q: "Why is a bulk audit slow?",
    a: "Lighthouse runs one site at a time so the speed numbers aren't skewed by other runs competing for your computer. Expect around 15–30 seconds per site.",
  },
  {
    q: "Is it OK to email people this way?",
    a: "You're the one sending, so the laws that cover your outreach (CAN-SPAM, GDPR/PECR, CASL and so on) are yours to follow. The drafts only say what the page shows, and they're short on purpose.",
  },
  {
    q: "Something's wrong in a report. Where do I tell you?",
    a: "Open an issue on GitHub with the site and the finding. Wrong findings are the bugs that matter most.",
  },
];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-20">
      <p className="pa-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 max-w-2xl font-serif text-4xl font-semibold leading-[1.1] text-ink">
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Fragment({
  n,
  title,
  body,
  children,
}: {
  n: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <p className="pa-eyebrow">
        <span className="text-accent">{n}</span> · {title}
      </p>
      <p className="mt-2 mb-4 text-[0.95rem] text-ink-2">{body}</p>
      <div className="pa-card mt-auto flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export default function Home() {
  const [criticalFinding, phoneFinding] = SAMPLE_REPORT.issues;

  return (
    <div className="flex flex-col">
      {/* Nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo size={22} />
        <div className="flex items-center gap-6 text-sm font-medium text-ink-2">
          <Link href="/prospects" className="hover:text-ink">
            Bulk audit
          </Link>
          <Link href="/compare" className="hover:text-ink">
            Compare
          </Link>
          <Link href="/branding" className="hidden hover:text-ink sm:block">
            Branding
          </Link>
          <a
            href={config.repoUrl}
            className="rounded-md border border-rule-strong px-3 py-1.5 text-ink hover:bg-sunken"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16 lg:pt-16">
        <div className="min-w-0">
          <p className="pa-eyebrow">Website audits for freelancers</p>
          <h1 className="mt-4 font-serif text-[2.75rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl">
            Audit a business&apos;s website.{" "}
            <span className="italic text-accent">Send them the report.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Paste an address. You get a plain-English audit that shows the evidence
            behind every finding, with your name on it and an email ready to send.
          </p>
          <div className="mt-8 max-w-xl">
            <AuditForm large />
            <p className="mt-3 text-sm text-muted">
              Runs on your computer. Free and open source.
            </p>
          </div>
          <HistoryStrip />
        </div>

        {/* The product, not a picture of it */}
        <div id="sample" className="min-w-0 scroll-mt-8">
          <div className="pa-sheet px-6 py-6">
            <ReportHeader brand={{ ...SAMPLE_BRAND, color: config.accentDefault }} date="Sample report" />
            <div className="flex items-center justify-between gap-4 py-6">
              <div className="min-w-0">
                <p className="pa-eyebrow">Audit of</p>
                <p className="mt-1 font-serif text-2xl font-semibold text-ink [overflow-wrap:anywhere]">
                  {SAMPLE_DOMAIN}
                </p>
                <p className="mt-2 max-w-[17rem] font-serif text-base leading-snug text-ink-2">
                  {SAMPLE_REPORT.overall.verdict}
                </p>
              </div>
              <GradeStamp
                grade={SAMPLE_REPORT.overall.grade}
                score={SAMPLE_REPORT.overall.score}
                size="md"
                tilt
              />
            </div>
            <ScoreTable categories={SAMPLE_REPORT.categories} single />
            <div className="mt-6 border-t border-ink">
              <IssueCard issue={criticalFinding} open />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            A sample report for a made-up bakery.
          </p>
        </div>
      </header>

      {/* What you get */}
      <div className="border-y border-rule bg-sunken/50">
        <Section
          id="how"
          eyebrow="One audit, three things you can use"
          title="A report, your name on it, and the email to go with it."
        >
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            <Fragment
              n="1"
              title="The report"
              body="Findings a business owner can follow, and the exact evidence behind each one, so nobody has to take your word for it."
            >
              <IssueCard issue={phoneFinding} open />
            </Fragment>
            <Fragment
              n="2"
              title="Your name on it"
              body="Set your name, logo, colours and contact line once. Every report and PDF carries them instead of ours."
            >
              <div className="px-5 py-5">
                <ReportHeader
                  brand={{ ...SAMPLE_BRAND, color: config.accentDefault }}
                  date="12 March 2026"
                />
                <p className="mt-5 font-serif text-lg font-semibold text-ink">
                  {SAMPLE_DOMAIN}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Prepared by {SAMPLE_BRAND.name} · {SAMPLE_BRAND.contact}
                </p>
              </div>
            </Fragment>
            <Fragment
              n="3"
              title="The email"
              body="Short drafts that quote only what the audit found. This one was written by the same code that writes yours."
            >
              <div className="px-5 py-5">
                <p className="text-sm">
                  <span className="pa-eyebrow mr-2">Subject</span>
                  <span className="font-medium text-ink">{SAMPLE_EMAIL.subject}</span>
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-[0.85rem] leading-relaxed text-ink-2">
                  {SAMPLE_EMAIL.body}
                </pre>
              </div>
            </Fragment>
          </div>
        </Section>
      </div>

      {/* Honest scope */}
      <Section eyebrow="Scope" title="What it checks, and what it can't.">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <p className="max-w-xl text-ink-2">
              Lighthouse for speed and accessibility, run in your own Chrome, plus more
              than 30 checks of our own on the page and its headers.
            </p>
            <dl className="mt-6 border-t border-ink">
              {CHECKS.map((c) => (
                <div
                  key={c.group}
                  className="grid gap-1 border-b border-rule py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-6"
                >
                  <dt className="font-medium text-ink">{c.group}</dt>
                  <dd className="text-sm text-ink-2">{c.covers}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="font-serif text-2xl font-semibold text-ink">What it can&apos;t do</h3>
            <ul className="mt-4 space-y-3 border-l-[3px] border-rule-strong pl-5 text-[0.95rem] text-ink-2">
              {LIMITS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="faq" eyebrow="Questions" title="Straight answers.">
        <div className="max-w-3xl border-t border-ink">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="font-mono text-lg text-faint group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="hidden font-mono text-lg text-faint group-open:inline">
                  −
                </span>
              </summary>
              <p className="pb-5 pr-8 text-[0.95rem] leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <Logo size={20} />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <a href={config.repoUrl} className="hover:text-ink">
              GitHub
            </a>
            <Link href="/branding" className="hover:text-ink">
              Branding
            </Link>
            <a href={`${config.repoUrl}/issues`} className="hover:text-ink">
              Report a wrong finding
            </a>
          </nav>
          <p className="text-xs text-faint">© {new Date().getFullYear()} {config.appName}</p>
        </div>
      </footer>
    </div>
  );
}
