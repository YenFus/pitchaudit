# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) instead, with
steps to reproduce. You'll get a reply as soon as possible.

## How the app protects itself

PitchAudit fetches websites that users name, so most of its attack surface is
server-side request forgery. The defences, all in `lib/audit/`:

- Only `http`/`https`, only ports 80 and 443, and no usernames or passwords in addresses.
- Private, loopback, link-local and other reserved addresses are refused. The
  address that is actually dialled is checked at connect time, so DNS
  rebinding can't slip past the check (`transport.ts`).
- Every redirect hop is re-checked; at most 5 hops.
- Responses are capped at 6 MB and every request has a timeout.
- Audits are rate-limited per client IP.

The app also sends a strict Content-Security-Policy and the usual security
headers (`next.config.ts`), stores nothing a user types on the server
(branding lives in the browser), and returns generic errors to clients.

## Self-hosting

- **Rate limiting needs the real client IP.** Forwarding headers can be forged,
  so they're only trusted on Vercel, or when you set `TRUST_PROXY_HEADERS=true`
  behind your own reverse proxy (which must set `X-Forwarded-For`/`X-Real-IP`).
  Without either, all visitors share one rate-limit bucket.
- Keep `PSI_API_KEY` and the Upstash token server-side. Never put them in a
  `NEXT_PUBLIC_*` variable.
- Keep dependencies current (`npm audit --omit=dev`).
