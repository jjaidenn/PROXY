import express from "express";
import helmet from "helmet";
import { Readable } from "node:stream";

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Only explicitly configured origins can be reached. Example:
// ALLOWED_ORIGINS='{"demo":"https://api.example.com"}'
let allowedOrigins = {};
try {
  allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS || "{}");
} catch {
  console.error("ALLOWED_ORIGINS must be valid JSON.");
  process.exit(1);
}

for (const [name, value] of Object.entries(allowedOrigins)) {
  const url = new URL(value);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error(`Production origin for "${name}" must use HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`Credentials are not allowed in origin "${name}".`);
  }
}

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.static("public", { extensions: ["html"] }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "proxy-core", configuredTargets: Object.keys(allowedOrigins).length });
});

app.get("/api/targets", (_req, res) => {
  res.json({ targets: Object.keys(allowedOrigins) });
});

// This is a restricted reverse proxy, not an open URL-fetching proxy.
// A caller can select only a named target configured by the operator.
app.all("/p/:target/*path", async (req, res) => {
  const base = allowedOrigins[req.params.target];
  if (!base) return res.status(404).json({ error: "Unknown proxy target." });

  try {
    const baseUrl = new URL(base);
    const rest = Array.isArray(req.params.path) ? req.params.path.join("/") : "";
    const upstream = new URL(rest + req.url.slice(req.url.indexOf("?") >= 0 ? req.url.indexOf("?") : req.url.length), baseUrl.href.endsWith("/") ? baseUrl : new URL(baseUrl.href + "/"));

    // Never permit a path to change the configured host.
    if (upstream.origin !== baseUrl.origin) {
      return res.status(400).json({ error: "Invalid upstream path." });
    }

    const headers = new Headers();
    for (const name of ["accept", "content-type", "if-none-match", "if-modified-since"]) {
      const value = req.headers[name];
      if (value) headers.set(name, value);
    }

    const hasBody = !["GET", "HEAD"].includes(req.method);
    const upstreamResponse = await fetch(upstream, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20000)
    });

    // Do not forward redirects to arbitrary external hosts.
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return res.status(502).json({ error: "Upstream redirects are disabled in this starter." });
    }

    for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
      const value = upstreamResponse.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    res.status(upstreamResponse.status);
    if (req.method === "HEAD" || !upstreamResponse.body) return res.end();
    Readable.fromWeb(upstreamResponse.body).pipe(res);
  } catch (error) {
    const status = error.name === "TimeoutError" ? 504 : 502;
    res.status(status).json({ error: status === 504 ? "Upstream timed out." : "Could not reach configured upstream." });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy core listening on port ${PORT}`);
  console.log(`Configured targets: ${Object.keys(allowedOrigins).join(", ") || "(none)"}`);
});