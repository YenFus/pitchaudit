# Contributing

Thanks for helping. A few notes so your time isn't wasted.

## Reporting a wrong finding

This is the most valuable thing you can send. Use the
[wrong finding](../../issues/new?template=wrong-finding.md) template and include
the site, the finding, and what's actually on the page. Only report sites you own
or whose owner is fine with it being public.

## Pull requests

- Open an issue first for anything bigger than a small fix, so we can agree on the approach.
- Run `npm test`, `npm run lint` and `npm run build` before pushing.
- New or changed checks need tests, including a page where the check must **not** fire.
  False positives are worse than misses: a freelancer may quote the finding to a client.
- Copy rules: plain English, no invented statistics, no fear language, and small
  issues are called small. See the header of `lib/audit/impact-copy.ts`.
- It runs on the user's machine: keep branding and history in the browser, and don't add calls to outside services.

## Code of conduct

Be kind and assume good intent.
