// PitchAudit runs on the user's own computer. Being on localhost doesn't make
// it private: any website open in the same browser can send requests to
// http://localhost:3000. These checks make sure only the user's own tab can
// drive it.

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Extra hostnames allowed via PITCHAUDIT_ALLOWED_HOSTS (comma-separated),
 *  for people who deliberately serve it under another name. */
function extraHosts(): Set<string> {
  return new Set(
    (process.env.PITCHAUDIT_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** "localhost:3000" → "localhost", "[::1]:3000" → "[::1]". */
function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

export function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  const name = hostnameOf(host);
  return LOCAL_HOSTNAMES.has(name) || extraHosts().has(name);
}

export type GuardVerdict = { ok: true } | { ok: false; status: number; reason: string };

/**
 * - Host must be this machine. Defeats DNS rebinding, where a malicious site
 *   points its own domain at 127.0.0.1 to read responses.
 * - API calls must come from this app's own pages: a cross-site Origin is
 *   refused, and POSTs must be JSON (which browsers won't send cross-site
 *   without a CORS preflight that this app never approves).
 */
export function checkLocalRequest(req: {
  method: string;
  pathname: string;
  headers: Headers;
}): GuardVerdict {
  const host = req.headers.get("host");
  if (!isAllowedHost(host)) {
    return { ok: false, status: 421, reason: "PitchAudit only answers on localhost." };
  }
  if (!req.pathname.startsWith("/api/")) return { ok: true };

  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false, status: 403, reason: "Cross-site request refused." };
    }
    if (originHost.toLowerCase() !== host!.toLowerCase()) {
      return { ok: false, status: 403, reason: "Cross-site request refused." };
    }
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return { ok: false, status: 403, reason: "Cross-site request refused." };
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json")) {
      return { ok: false, status: 415, reason: "Expected a JSON request." };
    }
  }
  return { ok: true };
}
