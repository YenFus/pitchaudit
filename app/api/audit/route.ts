import { NextResponse } from "next/server";
import {
  InvalidUrlError,
  normalizeUrl,
  runAudit,
  UnreachableError,
} from "@/lib/audit/engine";
import { config } from "@/lib/config";
import { rateAllowAsync, requestIp } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: string } | null;

  let normalized: string;
  try {
    normalized = normalizeUrl(body?.url ?? "");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof InvalidUrlError ? e.message : "Invalid URL." },
      { status: 400 }
    );
  }

  const { n, windowMin } = config.limits.rateLimit;
  if (!(await rateAllowAsync(requestIp(req), n, windowMin))) {
    return NextResponse.json(
      { error: "Too many audits in a short time — try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    return NextResponse.json(await runAudit(normalized));
  } catch (e) {
    if (e instanceof UnreachableError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("audit failed", e);
    return NextResponse.json(
      { error: "Something went wrong running the audit. Please try again." },
      { status: 500 }
    );
  }
}
