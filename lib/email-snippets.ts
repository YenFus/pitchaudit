// Cold-email drafts, built from the prospect's own findings.
//
// Rules the templates follow:
//  - Every claim comes from a finding's `pitch` sentence, which only says
//    what the page evidence supports.
//  - No promised results ("lift in enquiries"), no invented urgency, no
//    assumption the sender is an agency.
//  - Short. Someone reading a stranger's email gives it about ten seconds.

import type { Issue } from "./types";

export interface Snippet {
  id: string;
  label: string;
  subject: string;
  body: string;
}

export interface SnippetInput {
  domain: string;
  /** Findings in priority order. Only those with a `pitch` sentence are quoted. */
  topIssues: Issue[];
  /** Competitor domain, only for the comparison variant. */
  competitor?: string;
}

function pitchLines(issues: Issue[], max: number): string[] {
  return issues
    .map((i) => i.pitch?.trim())
    .filter((line): line is string => Boolean(line))
    .slice(0, max);
}

const bullets = (lines: string[]) => lines.map((l) => `• ${l}`).join("\n");

export function buildSnippets(input: SnippetInput): Snippet[] {
  const { domain, topIssues, competitor } = input;
  const lines = pitchLines(topIssues, 3);
  const first = lines[0];

  const snippets: Snippet[] = [
    {
      id: "plain",
      label: "Plain",
      subject: `A few things on ${domain}`,
      body: first
        ? `Hi [First name],

I ran ${domain} through an automated website check and a few things stood out:

${bullets(lines)}

I've written them up in plain English with what to change. Happy to send it over — free, no obligation.

[Your name]`
        : `Hi [First name],

I ran ${domain} through an automated website check and put together a short write-up of what I found. Happy to send it over — free, no obligation.

[Your name]`,
    },
    {
      id: "short",
      label: "Short",
      subject: `Quick question about ${domain}`,
      body: first
        ? `Hi [First name],

Do you look after ${domain} yourself? I ran a quick check on it and this stood out: ${first}

Happy to send the short write-up if it would be useful.

[Your name]`
        : `Hi [First name],

Do you look after ${domain} yourself? I ran a quick check on it and wrote up what I found. Happy to send it if it would be useful.

[Your name]`,
    },
    {
      id: "report",
      label: "Report offer",
      subject: `Website report for ${domain}`,
      body: first
        ? `Hi [First name],

I put together a short report on ${domain}. It starts with this: ${first}

The report is yours to keep, whoever ends up making the changes. Want me to send it over?

[Your name]`
        : `Hi [First name],

I put together a short report on ${domain}. It's yours to keep, whoever ends up making any changes. Want me to send it over?

[Your name]`,
    },
    {
      id: "formal",
      label: "Formal",
      subject: `Website review — ${domain}`,
      body: first
        ? `Dear [First name],

I reviewed ${domain} and prepared a short report. The main points:

${bullets(lines)}

I'd be glad to walk you through it in ten minutes if that would be useful.

Kind regards,
[Your name]`
        : `Dear [First name],

I reviewed ${domain} and prepared a short report. I'd be glad to walk you through it in ten minutes if that would be useful.

Kind regards,
[Your name]`,
    },
  ];

  if (competitor) {
    snippets.push({
      id: "competitor",
      label: "Vs. a competitor",
      subject: `${domain} compared with ${competitor}`,
      body: first
        ? `Hi [First name],

I compared ${domain} with ${competitor} on speed, search visibility and mobile. A few things stood out on ${domain}'s side:

${bullets(lines)}

I've put the comparison into a short report — want a copy?

[Your name]`
        : `Hi [First name],

I compared ${domain} with ${competitor} on speed, search visibility and mobile, and put the comparison into a short report — want a copy?

[Your name]`,
    });
  }

  return snippets;
}
