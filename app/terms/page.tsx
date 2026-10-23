import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/LegalPage";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `The terms for using the hosted version of ${config.appName}.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="October 23, 2026">
      <p>
        {config.appName}{" "}
        is free, open-source software. These terms cover this hosted copy of it. The
        source code itself is licensed separately, under the{" "}
        <a className="text-ink underline underline-offset-2" href={`${config.repoUrl}/blob/main/LICENSE`}>
          MIT License
        </a>
        .
      </p>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Audit publicly reachable websites only.</li>
          <li>
            Don&apos;t use it to attack, overload, or probe a site, or to get around the
            rate limits.
          </li>
          <li>
            Don&apos;t hammer the API with automated requests. If you need volume, run
            your own copy — it&apos;s open source.
          </li>
          <li>Don&apos;t use it to break the law or to mislead people.</li>
        </ul>
      </section>

      <section>
        <h2>Audit results are automated</h2>
        <p>
          Findings come from automated checks and Google&apos;s PageSpeed Insights. They
          can be incomplete, out of date, or wrong for a particular site — for example
          when a site blocks automated requests or a third-party test is unavailable. Each
          finding shows the evidence behind it; check it before you send a report to
          anyone. Nothing here promises rankings, traffic, or revenue.
        </p>
      </section>

      <section>
        <h2>Outreach is your responsibility</h2>
        <p>
          The email drafts are starting points. If you send them, you are the sender and
          are responsible for following the laws that apply to your outreach, such as
          CAN-SPAM, GDPR/PECR, and CASL, and for what your messages claim.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;, without warranties of any kind, and
          may change, slow down or stop at any time. To the extent the law allows, the
          maintainers aren&apos;t liable for any loss arising from its use.
        </p>
      </section>

      <section>
        <h2>Questions and bugs</h2>
        <p>
          Open an issue on <ContactLine />. If a report gets something wrong, include the
          site and the finding — that&apos;s the most useful bug report there is.
        </p>
      </section>
    </LegalPage>
  );
}
