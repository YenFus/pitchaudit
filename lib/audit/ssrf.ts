import dns from "node:dns/promises";

export class InvalidUrlError extends Error {}
export class UnreachableError extends Error {}

/** Checks if an IPv4 or IPv6 address string belongs to a private, loopback, or reserved range */
export function isPrivateIp(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^::ffff:/i, "").replace(/^\[|\]$/g, "");
  if (clean === "::" || clean === "::1" || clean === "0.0.0.0") return true;
  if (
    clean.startsWith("fc") ||
    clean.startsWith("fd") ||
    clean.startsWith("fe80:")
  ) {
    return true;
  }

  const parts = clean.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 0) return true; // current network (0.0.0.0/8)
    if (a === 10) return true; // private (10.0.0.0/8)
    if (a === 127) return true; // loopback (127.0.0.0/8)
    if (a === 169 && b === 254) return true; // link-local (169.254.0.0/16)
    if (a === 172 && b >= 16 && b <= 31) return true; // private (172.16.0.0/12)
    if (a === 192 && b === 168) return true; // private (192.168.0.0/16)
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (100.64.0.0/10)
    if (a >= 224) return true; // multicast / reserved (224.0.0.0/4 and 240.0.0.0/4)
  }
  return false;
}

/** Checks if a hostname is local, internal, or resolves to a private IP representation */
export function isPrivateHost(host: string): boolean {
  const clean = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    clean === "localhost" ||
    clean === "0.0.0.0" ||
    clean === "::" ||
    clean === "::1" ||
    clean.endsWith(".local") ||
    clean.endsWith(".internal") ||
    clean.endsWith(".localhost") ||
    clean.endsWith(".onion")
  ) {
    return true;
  }
  if (isPrivateIp(clean)) return true;
  return false;
}

/** Only standard web ports, and no credentials in the address. Stops the
 *  auditor being used to probe other services (SSH, databases…) on public
 *  hosts, and keeps passwords out of fetches and cache keys. */
export function assertAllowedUrl(url: URL): void {
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new InvalidUrlError("Only websites on the standard ports (80 and 443) can be audited.");
  }
  if (url.username || url.password) {
    throw new InvalidUrlError("Addresses with a username or password can't be audited.");
  }
}

/** Resolves hostname via DNS to prevent DNS rebinding attacks to internal infrastructure */
export async function assertSafePublicHost(hostname: string): Promise<void> {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isPrivateHost(clean)) {
    throw new InvalidUrlError("Private and local addresses can't be audited.");
  }

  // If host is an IP, verify directly
  if (isPrivateIp(clean)) {
    throw new InvalidUrlError("Private and local addresses can't be audited.");
  }

  try {
    const records = await dns.lookup(clean, { all: true });
    if (!records || records.length === 0) {
      throw new UnreachableError("We couldn't reach this site. Check the address, or the server may be down.");
    }
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new InvalidUrlError("Private and local addresses can't be audited.");
      }
    }
  } catch (err) {
    if (err instanceof InvalidUrlError || err instanceof UnreachableError) throw err;
    throw new UnreachableError("We couldn't reach this site at all. Check the address, or the server may be down.");
  }
}
