# PROXY

A static, same-origin browser workspace with first-party mini-apps and a small Supabase API explorer.

## Live architecture

- **Website:** GitHub Pages serves the contents of `public/`.
- **Frontend assets:** CSS and JavaScript are loaded from the same GitHub Pages origin.
- **Internal apps:** `public/apps/` contains first-party pages that open inside PROXY's existing tab view.
- **API tools:** `public/apps/api/` talks to the Supabase Edge Function at `/functions/v1/proxy-api`.
- **API backend:** Supabase Edge Function; upstreams are restricted to fixed HTTPS origins configured by the project operator.

There is no Docker deployment or separate Express server in this architecture.

## Browser behavior and limitations

The interface provides tabs, per-tab navigation history, address/search handling, and same-tab navigation. First-party apps hosted under `public/apps/` work inside the browser view.

External sites can be shown only when they permit framing. Some sites intentionally block iframe embedding; PROXY respects those policies. This project is **not** a general-purpose browser proxy and does not rewrite arbitrary sites, forward login cookies, or bypass network/site access controls.

## Internal apps

- `proxy://apps` — app directory
- `proxy://demo` — demo app
- `proxy://api` — Supabase API explorer

To add an app, create `public/apps/your-app/index.html` and link it from `public/apps/index.html`.

## Supabase API gateway

Function URL:

`https://teqctrceotdzzcxynlzb.supabase.co/functions/v1/proxy-api`

Configure the Edge Function secret `ALLOWED_ORIGINS` as a JSON object mapping short names to fixed HTTPS API origins, for example:

```json
{"my-api":"https://api.example.com"}
```

Only configure services you own or are authorized to access. Keep private credentials in Supabase Function Secrets; never put them in frontend code or this repository. The publishable key in `public/assets/app.js` is intended for browser use.

Gateway limits include fixed allowlisted origins, GET-only upstream requests, blocked redirects, JSON/plain-text responses, a 500 KB response cap, and a 10-second upstream timeout.

## Deployment

The GitHub Actions workflow deploys `public/` to GitHub Pages on changes to that directory. The backend smoke-test workflow checks the configured Supabase function and sample upstreams. The weather provider check is best-effort because the external provider can rate-limit or temporarily fail independently of PROXY.
