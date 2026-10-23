// The only way the audit engine talks to a site it is auditing.
//
// Two protections that `fetch` alone can't give:
//  1. DNS-rebinding safe. The hostname is resolved once, at connect time,
//     and the address that is actually dialled is checked. Checking the
//     hostname first and then calling fetch (which resolves again) leaves a
//     window in which an attacker's DNS can answer with a private address.
//  2. Bounded. A page larger than MAX_BODY_BYTES is cut off instead of being
//     read into memory.

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type net from "node:net";
import { Readable, Transform } from "node:stream";
import zlib from "node:zlib";
import { InvalidUrlError, isPrivateIp } from "./ssrf";

export const MAX_BODY_BYTES = 6 * 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("The page is too large to audit.");
  }
}

/** dns.lookup replacement that refuses to hand back a private address. */
export const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, records) => {
    if (err) return callback(err, "", 0);
    const list = (records ?? []) as dns.LookupAddress[];
    if (list.length === 0 || list.some((r) => isPrivateIp(r.address))) {
      return callback(
        new InvalidUrlError("Private and local addresses can't be audited."),
        "",
        0
      );
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export interface TransportOptions {
  method: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(name, v);
    else headers.set(name, String(value));
  }
  return headers;
}

/** One HTTP(S) request, no redirects followed. Resolves at response headers.
 *  Exposed with an injectable `lookup` so tests can use a local server. */
export function requestWith(
  lookup: net.LookupFunction,
  url: string,
  { method, headers, signal }: TransportOptions
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === "https:" ? https : http;

    const req = lib.request(
      target,
      { method, headers, signal, lookup },
      (res) => {
        const status = res.statusCode ?? 0;
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const responseHeaders = toHeaders(res.headers);

        let body: Readable = res;
        if (encoding === "gzip" || encoding === "x-gzip" || encoding === "deflate") {
          body = res.pipe(zlib.createUnzip());
        } else if (encoding === "br") {
          body = res.pipe(zlib.createBrotliDecompress());
        }
        if (encoding) {
          responseHeaders.delete("content-encoding");
          responseHeaders.delete("content-length");
        }
        res.on("error", (e) => body.destroy(e));

        let seen = 0;
        const limiter = new Transform({
          transform(chunk: Buffer, _encoding, done) {
            seen += chunk.length;
            if (seen > MAX_BODY_BYTES) return done(new BodyTooLargeError());
            done(null, chunk);
          },
        });
        body.on("error", (e) => limiter.destroy(e));
        // Once the cap is hit (or the reader gives up), free the socket so a
        // hostile server can't hold it open by trickling data.
        limiter.on("error", () => {
          body.destroy();
          res.destroy();
        });
        limiter.on("close", () => {
          if (!res.complete) res.destroy();
        });

        const noBody =
          method === "HEAD" || status === 204 || status === 205 || status === 304;
        if (noBody) res.resume();

        try {
          resolve(
            new Response(
              noBody ? null : (Readable.toWeb(body.pipe(limiter)) as unknown as ReadableStream),
              {
                status,
                statusText: res.statusMessage,
                headers: responseHeaders,
              }
            )
          );
        } catch (e) {
          res.destroy();
          reject(e);
        }
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** The audit engine's request function: every dialled address is checked. */
export function guardedRequest(
  url: string,
  options: TransportOptions
): Promise<Response> {
  return requestWith(safeLookup, url, options);
}
