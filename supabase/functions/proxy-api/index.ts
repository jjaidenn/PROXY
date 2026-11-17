// Read-only, allowlisted API gateway. Configure ALLOWED_ORIGINS in Supabase Function Secrets.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

type TargetMap = Record<string, string>;
let targets: TargetMap = {};
try {
  targets = JSON.parse(Deno.env.get("ALLOWED_ORIGINS") || "{}");
  if (!targets || typeof targets !== "object" || Array.isArray(targets)) throw new Error("Expected an object");
  for (const [name, value] of Object.entries(targets)) {
    if (!/^[a-z0-9-]{1,40}$/i.test(name) || typeof value !== "string") throw new Error("Invalid target configuration");
    const origin = new URL(value);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
      throw new Error("Targets must be clean HTTPS origins without credentials, query strings, or fragments");
    }
  }
} catch (error) {
  console.error("Invalid ALLOWED_ORIGINS configuration", error);
  targets = {};
}

const windows = new Map<string, { start: number; count: number }>();
function isLimited(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = windows.get(ip);
  if (!entry || now - entry.start > 60_000) {
    windows.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

function safePath(value: unknown): string[] | null {
  if (typeof value !== "string" || value.length > 500 || value.startsWith("//") || value.includes("\\\\")) return null;
  const path = value.replace(/^\\/+/, "");
  if (!path) return [];
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\\u0000-\\u001f]/.test(part))) return null;
  return parts;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return reply({ ok: true, service: "proxy-api", mode: "allowlisted-read-only", configuredTargets: Object.keys(targets).length });
  }
  if (req.method === "GET" && url.pathname.endsWith("/targets")) {
    return reply({ targets: Object.keys(targets).sort() });
  }
  if (req.method !== "POST" || !url.pathname.endsWith("/fetch")) {
    return reply({ error: "Use GET /health, GET /targets, or POST /fetch." }, 404);
  }
  if (isLimited(req)) return reply({ error: "Rate limit reached. Wait a minute and try again." }, 429);

  try {
    const body = await req.json();
    const targetName = String(body.target || "");
    const base = targets[targetName];
    if (!base) return reply({ error: "Unknown configured service." }, 404);

    const parts = safePath(body.path ?? "");
    if (!parts) return reply({ error: "Enter a safe relative path. Absolute URLs and dot segments are not allowed." }, 400);

    const baseUrl = new URL(base);
    const upstream = new URL(baseUrl.href);
    const basePath = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : baseUrl.pathname + "/";
    upstream.pathname = basePath + parts.map(encodeURIComponent).join("/");
    const query = body.query && typeof body.query === "object" && !Array.isArray(body.query) ? body.query : {};
    for (const [key, value] of Object.entries(query)) {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        return reply({ error: "Query values must be text, numbers, or booleans." }, 400);
      }
      upstream.searchParams.set(key, String(value));
    }
    if (upstream.origin !== baseUrl.origin) return reply({ error: "Invalid upstream destination." }, 400);

    const upstreamResponse = await fetch(upstream, {
      method: "GET",
      headers: { "Accept": "application/json, text/plain;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      return reply({ error: "Redirects from upstream services are not followed." }, 502);
    }

    const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
    if (!/application\\/(?:[a-z0-9.+-]+\\+)?json|text\\/plain/i.test(contentType)) {
      return reply({ error: "This gateway only returns JSON or plain-text API responses." }, 415);
    }
    const raw = await upstreamResponse.text();
    if (raw.length > 500_000) return reply({ error: "Upstream response is too large (500 KB limit)." }, 413);

    let data: unknown = raw;
    if (/json/i.test(contentType)) {
      try { data = JSON.parse(raw); } catch { data = raw; }
    }
    return reply({ ok: upstreamResponse.ok, status: upstreamResponse.status, contentType, data }, upstreamResponse.ok ? 200 : 502);
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return reply({ error: timeout ? "Configured service timed out." : "Could not complete the request." }, timeout ? 504 : 400);
  }
});
