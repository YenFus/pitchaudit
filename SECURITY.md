# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) instead, with
steps to reproduce.

## What PitchAudit does on your computer

PitchAudit runs entirely on your machine. When you audit a site it:

- fetches that page (and its robots.txt, sitemap and favicon) from your computer;
- runs Lighthouse in a hidden, separate copy of Chrome (a fresh profile, not
  your own: no cookies, logins or extensions), which loads the page like a
  normal browser visit;
- keeps the result in memory for an hour, and your branding and recent audits
  in your browser's local storage.

Nothing is sent to us. Nothing is sent to Google unless you set `PSI_API_KEY`
and Chrome isn't available.

## How it protects you

**From other websites in your browser.** Any website you have open could try
to send requests to `http://localhost:3000`. PitchAudit refuses:

- requests whose `Host` isn't `localhost`/`127.0.0.1`, which defeats DNS
  rebinding (a malicious domain pointed at your machine);
- API calls from another site's `Origin`, or marked cross-site by the browser;
- API calls that aren't JSON, which are the only kind another site can send
  without your browser asking permission first.

See [lib/local-guard.ts](lib/local-guard.ts).

**From your network.** It listens on `127.0.0.1` only, so other devices on your
Wi-Fi can't reach it. If you change that, you're responsible for who can.

**From being turned against your own network.** The audit's own requests:

- only go to `http`/`https` addresses on ports 80 and 443, with no
  usernames or passwords in them;
- never go to private, loopback or link-local addresses (your router, other
  machines on your network, cloud metadata services). The address actually
  dialled is checked at connect time, so DNS tricks can't get around it;
- re-check every redirect, stop after 5, time out, and stop reading after 6 MB.

See [lib/audit/transport.ts](lib/audit/transport.ts) and
[lib/audit/ssrf.ts](lib/audit/ssrf.ts).

One honest limit: Lighthouse loads the page in Chrome the way your own browser
would, including whatever images and scripts the page asks for. That's the
same exposure as visiting the site yourself, but in an isolated profile.

**In the app itself.** A strict Content-Security-Policy and the usual security
headers ([next.config.ts](next.config.ts)), React's escaping for everything the
audited page contains, and spreadsheet-formula protection in CSV exports.

## Keeping it up to date

Run `git pull && npm install` now and then, and `npm audit --omit=dev` to
check the dependencies.
