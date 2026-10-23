import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import dns from "node:dns";
import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import {
  BodyTooLargeError,
  MAX_BODY_BYTES,
  guardedRequest,
  requestWith,
  safeLookup,
} from "@/lib/audit/transport";
import { InvalidUrlError } from "@/lib/audit/ssrf";

/* eslint-disable @typescript-eslint/no-explicit-any */

function lookupResult(addresses: string[]) {
  return vi.spyOn(dns, "lookup").mockImplementation(((
    _host: string,
    _opts: any,
    cb: any
  ) => {
    cb(null, addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
  }) as any);
}

describe("safeLookup (connect-time address check)", () => {
  beforeEach(() => vi.restoreAllMocks());

  const run = (opts: dns.LookupOptions = {}) =>
    new Promise<{ err: Error | null; address: any }>((resolve) =>
      safeLookup("any.example", opts, (err, address) => resolve({ err, address }))
    );

  it("returns a public address", async () => {
    lookupResult(["93.184.216.34"]);
    const { err, address } = await run();
    expect(err).toBeNull();
    expect(address).toBe("93.184.216.34");
  });

  it("returns the whole list when asked for all addresses", async () => {
    lookupResult(["93.184.216.34", "2606:2800:220:1::1"]);
    const { address } = await run({ all: true });
    expect(address).toHaveLength(2);
  });

  it.each(["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1", "fd00::1"])(
    "refuses %s",
    async (ip) => {
      lookupResult([ip]);
      const { err } = await run();
      expect(err).toBeInstanceOf(InvalidUrlError);
    }
  );

  it("refuses when ANY of several answers is private (mixed-answer rebinding)", async () => {
    lookupResult(["93.184.216.34", "127.0.0.1"]);
    expect((await run({ all: true })).err).toBeInstanceOf(InvalidUrlError);
  });

  it("refuses an empty answer", async () => {
    lookupResult([]);
    expect((await run()).err).toBeInstanceOf(InvalidUrlError);
  });
});

describe("DNS rebinding", () => {
  let server: http.Server;
  let port: number;
  let connections = 0;

  beforeEach(async () => {
    vi.restoreAllMocks();
    connections = 0;
    server = http.createServer((_req, res) => res.end("internal secret"));
    server.on("connection", () => connections++);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise<void>((r) => server.close(() => r())));

  it("never connects when the hostname resolves to a private address at dial time", async () => {
    // The pre-check saw a public IP; by the time we dial, DNS says loopback.
    lookupResult(["127.0.0.1"]);
    await expect(
      guardedRequest(`http://rebind.example:${port}/`, { method: "GET", headers: {} })
    ).rejects.toBeInstanceOf(InvalidUrlError);
    expect(connections).toBe(0);
  });
});

describe("transport behaviour (local server, permissive lookup)", () => {
  let server: http.Server;
  let base: string;
  const permissive: any = (h: string, o: any, cb: any) => dns.lookup(h, o, cb);

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      if (url === "/gzip") {
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
        res.end(zlib.gzipSync("<h1>hello gzip</h1>"));
      } else if (url === "/br") {
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "br" });
        res.end(zlib.brotliCompressSync("<h1>hello brotli</h1>"));
      } else if (url === "/cookies") {
        res.writeHead(200, { "set-cookie": ["a=1; Secure", "b=2; SameSite=Lax"] });
        res.end("ok");
      } else if (url === "/redirect") {
        res.writeHead(301, { location: "/final" });
        res.end();
      } else if (url === "/huge") {
        res.writeHead(200, { "content-type": "text/html" });
        const chunk = Buffer.alloc(1024 * 1024, "a");
        let sent = 0;
        const write = () => {
          while (sent < MAX_BODY_BYTES + 2 * chunk.length) {
            sent += chunk.length;
            if (!res.write(chunk)) return void res.once("drain", write);
          }
          res.end();
        };
        write();
      } else {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<p>plain</p>");
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(() => {
    server.closeAllConnections();
    return new Promise<void>((r) => server.close(() => r()));
  });

  const get = (path: string, method = "GET") =>
    requestWith(permissive, base + path, { method, headers: { "accept-encoding": "gzip, br" } });

  it("returns status, headers and body", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(await res.text()).toBe("<p>plain</p>");
  });

  it("decodes gzip and brotli and drops the encoding headers", async () => {
    const gz = await get("/gzip");
    expect(gz.headers.get("content-encoding")).toBeNull();
    expect(await gz.text()).toBe("<h1>hello gzip</h1>");
    expect(await (await get("/br")).text()).toBe("<h1>hello brotli</h1>");
  });

  it("keeps every Set-Cookie header separate", async () => {
    const res = await get("/cookies");
    expect(res.headers.getSetCookie()).toEqual(["a=1; Secure", "b=2; SameSite=Lax"]);
  });

  it("passes redirects through untouched for the caller to validate", async () => {
    const res = await get("/redirect");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/final");
  });

  it("HEAD responses have no body", async () => {
    const res = await get("/", "HEAD");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("cuts off a body larger than the cap instead of reading it all", async () => {
    const res = await get("/huge");
    await expect(res.text()).rejects.toSatisfy(
      (e: any) => e instanceof BodyTooLargeError || e?.cause instanceof BodyTooLargeError
    );
  });

  it("tears the connection down once the cap is hit (no held-open socket)", async () => {
    const closed = new Promise<void>((resolve) => {
      server.once("connection", (socket) => socket.once("close", () => resolve()));
    });
    const res = await get("/huge");
    await res.text().catch(() => undefined);
    await expect(
      Promise.race([closed, new Promise((_, rej) => setTimeout(() => rej(new Error("socket still open")), 4000))])
    ).resolves.toBeUndefined();
  });

  it("honours an abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestWith(permissive, base + "/", { method: "GET", headers: {}, signal: controller.signal })
    ).rejects.toBeDefined();
  });
});
