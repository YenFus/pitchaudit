import { NextResponse, type NextRequest } from "next/server";
import { checkLocalRequest } from "@/lib/local-guard";

// Runs before every request. See lib/local-guard.ts for why.
export function proxy(request: NextRequest) {
  const verdict = checkLocalRequest({
    method: request.method,
    pathname: request.nextUrl.pathname,
    headers: request.headers,
  });
  if (!verdict.ok) {
    return new NextResponse(verdict.reason, {
      status: verdict.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}
