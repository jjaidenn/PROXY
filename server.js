import express from "express";
import helmet from "helmet";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const requestCounts = new Map();

let allowedOrigins = {};
try {
  allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS || "{}");
} catch {
  console.error("ALLOWED_ORIGINS must be valid JSON.");
  process.exit(1);
}

for (const [name, value] of Object.entries(allowedOrigins)) {
  if (!/^[a-z0-9-]{1,40}$/i.test(name)) throw new Error(`Invalid target name: ${name}`);
  const url = new URL(value);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error(`Production origin for "${name}" must use HTTPS.`);
  }
  if (url.username || url.password) throw new Error(`Credentials are not allowed in origin "${name}".`);
  if (url.search || url.hash) throw new Error(`Origin for "${name}" must not include a query or fragment.`);
}

app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));

app.use((req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = requestCounts.get(key);
  if (!current || now - current.start >= WINDOW_MS) {
    requestCounts.set(key, { start: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Rate limit reached. Try again shortly." });
  }
  next();
});

app.use(express.static("public", { extensions: ["html"], maxAge: "1h" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "proxy-core", configuredTargets: Object.keys(allowedOrigins).length });
});

app.get("/api/targets", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ targets: Object.keys(allowedOrigins).sort() });
});

async function handleProxy(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    return res.status(405).json({ error: "Only GET and HEAD requests are enabled in this starter." });
  }

  const targetName = req.params.target;
  const base = allowedOrigins[targetName];
  if (!base) return res.status(404).json({ error: "Unknown configured target." });

  try {
    const baseUrl = new URL(base);
    const rawSegments = Array.isArray(req.params.path) ? req.params.path : [];
    if (rawSegments.some(part => part === "." || part === ".." || part.includes("/") || part.includes("\\") || /[\\u0000-\\u001f]/.test(part))) {
      return res.status(400).json({ error: "Invalid path." });
    }

    const upstream = new URL(baseUrl.href);
    const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;
    upstream.pathname = basePath + rawSegments.map(part => encodeURIComponent(part)).join("/");
    upstream.search = new URL(req.originalUrl, "http://local.invalid").search;

    if (upstream.origin !== baseUrl.origin) {
      return res.status(400).json({ error: "Invalid upstream destination." });
    }

    const headers = new Headers();
    for (const name of ["accept", "if-none-match", "if-modified-since"]) {
      const value = req.headers[name];
      if (value) headers.set(name, value);
    }

    const upstreamResponse = await fetch(upstream, {
      method: req.method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });

    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return res.status(502).json({ error: "The configured service returned a redirect; redirects are not followed." });
    }

    for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
      const value = upstreamResponse.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(upstreamResponse.status);
    if (req.method === "HEAD" || !upstreamResponse.body) return res.end();

    const body = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(body);
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "Configured service timed out." : "Could not reach the configured service."
    });
  }
}

app.all("/p/:target", handleProxy);
app.all("/p/:target/*path", handleProxy);

app.listen(PORT, () => {
  console.log(`PROXY listening on port ${PORT}`);
  console.log(`Configured targets: ${Object.keys(allowedOrigins).join(", ") || "(none)"}`);
});
