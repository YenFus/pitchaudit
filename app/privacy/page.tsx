import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${config.appName} handles the website addresses you audit and your branding.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 29, 2026">
      <p>
        {config.appName}{" "}
        is built to hold as little data as possible. There are no accounts,
        and we don&apos;t use cookies, advertising trackers, or analytics
        scripts. This page explains exactly what is processed and where.
      </p>

      <section>
        <h2>Websites you audit</h2>
        <p>
          When you run an audit, the address you enter is sent to our server.
          The server requests that public page (plus its robots.txt, sitemap,
          favicon, and the plain-http version of the address) the way a visitor
          would, identifying itself as &ldquo;PitchAudit&rdquo;. The address is
          also sent to Google&apos;s PageSpeed Insights API, which runs the
          speed test. Google handles it under its own privacy policy.
        </p>
        <p className="mt-3">
          Audit results are cached for up to one hour so repeat audits are
          fast. The cache holds the audited address and the findings, not
          anything about you.
        </p>
      </section>

      <section>
        <h2>Your IP address</h2>
        <p>
          We use your IP address only to rate-limit requests, and only for the
          short window (about 10 minutes) the limit applies. Our hosting
          provider may also keep ordinary server logs of requests under its own
          policy.
        </p>
      </section>

      <section>
        <h2>Your branding, logo, and audit history</h2>
        <p>
          Your white-label name, contact line, logo, colors, and recent audit
          history are stored only in your browser&apos;s local storage. They are
          never sent to us. Clearing your browser data, or &ldquo;Remove branding&rdquo; on the branding page, removes them. The flip side:
          switching browsers or devices means setting them up again.
        </p>
      </section>

      <section>
        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t sell or share your data.</li>
          <li>We don&apos;t build profiles or track you across sites.</li>
          <li>We don&apos;t send email — we never collect your address.</li>
        </ul>
      </section>

      <section>
        <h2>Your choices and contact</h2>
        <p>
          Because we keep nothing about you server-side beyond the short-lived
          items above, there is generally nothing to delete on our end. For any
          privacy question or request, contact <ContactLine />.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes we will update the date at the top of this
          page.
        </p>
      </section>
    </LegalPage>
  );
}
