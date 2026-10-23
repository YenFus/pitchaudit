# PitchAudit

**Audit a business's website. Send them the report.**

PitchAudit is a free, open-source website audit tool for freelancers and small
agencies that **runs on your own computer**. Paste an address and you get a
plain-English report that shows the evidence behind every finding, with your
name on it and a short email ready to send.

No account, no server of ours, no API key, and no AI: every check is a fixed
rule, so the same page gives the same report every time.

![PitchAudit](docs/screenshot.png)

## Run it

You need [Node.js](https://nodejs.org) 22.19 or newer and
[Google Chrome](https://www.google.com/chrome/).

```bash
git clone https://github.com/YenFus/pitchaudit
cd pitchaudit
npm install
npm start
```

Then open **http://localhost:3000**. (`npm start` builds the app the first
time, which takes a few seconds.) It only listens on your own machine, so
other devices on your network can't reach it.

To use a different port: `PORT=4000 npm start`.

## What it does

- **Audits a public web page** with Lighthouse (speed, accessibility, SEO and
  best practices), run in a hidden copy of your own Chrome, plus 30+ checks of
  its own: search visibility, mobile, conversion basics, accessibility and
  security basics.
- **Shows its evidence.** Every finding says what it saw on the page: the actual
  `<title>` tag, the missing header, the image files with no alt text. You can
  check a claim in seconds before your name goes on it.
- **Explains each finding** in plain English: why it matters, how much, and how
  to fix it. Small things are called small.
- **Writes the email.** Short drafts that quote only what the audit found. No
  promised results.
- **Puts your name on it.** Your name, logo, colour and contact line on every
  report (set them on the Branding page), then print to PDF.
- **Bulk audits** up to 25 sites, ranked weakest first, with CSV export.
- **Compares** a site with a competitor, category by category.

Your branding and recent audits are stored in your browser.

## What it doesn't do

- No backlink, keyword-ranking or traffic data. That needs a paid SEO database.
- It reads the public page only. Anything behind a login, or added only after
  the page loads, is invisible to its own checks.
- Some sites turn automated visitors away. You get a clear message rather than
  a wrong report.
- Without Chrome, speed and accessibility can't be measured: they're marked
  **not measured** and the grade is **provisional** instead of being guessed.
- Lighthouse runs one site at a time so the speed numbers are fair, so a bulk
  audit takes roughly 15–30 seconds per site.

## How accurate is it?

The checks were run on 33 real small-business sites and every result was
compared with an independent script. The disagreements turned out to be bugs,
and they're fixed and covered by tests
([tests/false-positives.test.ts](tests/false-positives.test.ts)). Automated
audits still get things wrong, which is why every finding shows its evidence.
If you find a wrong finding, please
[open an issue](../../issues/new?template=wrong-finding.md).

## Settings

All optional. Put them in a `.env.local` file (see [.env.example](.env.example)).

| Variable | |
|---|---|
| `CHROME_PATH` | Path to Chrome or Chromium, if it isn't installed in the usual place. |
| `PSI_API_KEY` | Fallback for computers without Chrome: Google's hosted [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started) (free key). With this set, sites you audit are sent to Google when Chrome isn't available. |
| `PITCHAUDIT_ALLOWED_HOSTS` | Extra hostnames to answer on besides `localhost`, only if you deliberately serve it under another name on a network you trust. |

The bulk-audit size and product name live in [lib/config.ts](lib/config.ts).

## How it works

| Piece | Where |
|---|---|
| Direct checks: HTML, headers, robots.txt, sitemap, favicon, http→https | [lib/audit/checks.ts](lib/audit/checks.ts) |
| Lighthouse in local Chrome (and the optional Google fallback) | [lib/audit/lighthouse.ts](lib/audit/lighthouse.ts), [lib/audit/psi.ts](lib/audit/psi.ts) |
| Scoring, and leaving out what couldn't be measured | [lib/audit/score.ts](lib/audit/score.ts) |
| Plain-English copy and the one-line email sentence for each finding | [lib/audit/impact-copy.ts](lib/audit/impact-copy.ts) |
| Email drafts | [lib/email-snippets.ts](lib/email-snippets.ts) |
| Fetching sites safely | [lib/audit/transport.ts](lib/audit/transport.ts), [lib/audit/ssrf.ts](lib/audit/ssrf.ts) |
| Only answering your own browser tab | [lib/local-guard.ts](lib/local-guard.ts), [proxy.ts](proxy.ts) |

### Adding a check

1. Detect it in `runHtmlAndHeaderChecks` (or `runChecks` for network probes)
   in [lib/audit/checks.ts](lib/audit/checks.ts), and push an issue with an
   `id`, a `severity`, a `finding` and `evidence` lines saying what you saw.
2. Add its title, impact and fix to
   [lib/audit/impact-copy.ts](lib/audit/impact-copy.ts). Add a `pitch` sentence
   only if it's worth leading an email with.
3. Add tests, including at least one page where it must **not** fire.

## Development

```bash
npm run dev         # http://localhost:3000, reloads on change
npm test            # offline test suite
npm run test:live   # also audits a few real websites (needs a network and Chrome)
npm run lint
```

`?print=1` on any report shows the print/PDF layout.

## Security

See [SECURITY.md](SECURITY.md) for how it protects your computer and network,
and how to report a vulnerability privately.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
The most useful contribution is a report of a finding that's wrong on a real
site.

## License

[MIT](LICENSE)
