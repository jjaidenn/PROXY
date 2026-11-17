# PROXY — Supabase API Gateway

A small, read-only gateway for APIs and services you own or are authorized to access.

## Architecture

- **Frontend:** static HTML and CSS/JavaScript assets in this repository.
- **Asset delivery:** jsDelivr serves the CSS, JavaScript, and SVG files.
- **Backend:** Supabase Edge Function `proxy-api`.
- **Upstreams:** fixed HTTPS origins configured by the project operator in Supabase Function Secrets.

This is an allowlisted API gateway, not a full browser proxy. It does not rewrite arbitrary websites, forward login cookies, or bypass access controls. Only JSON/plain-text API responses are supported; only GET requests are made to upstream services.

## Supabase setup

Project URL: `https://teqctrceotdzzcxynlzb.supabase.co`

Function URL: `https://teqctrceotdzzcxynlzb.supabase.co/functions/v1/proxy-api`

Configure the Supabase Edge Function secret `ALLOWED_ORIGINS` as a JSON object mapping short names to fixed HTTPS API origins, for example:

```json
{"my-api":"https://api.example.com"}
```

Do not add private endpoints unless you have an appropriate authentication layer. Do not put secret keys in this repository or in frontend code. The publishable key in `public/assets/app.js` is intended for browser use.

## jsDelivr assets

- CSS: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/app.css
- JavaScript: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/app.js
- SVG: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/mark.svg

The HTML page itself must be served by a static website host. jsDelivr is used for the assets; it does not execute backend code.

## Limits

- Fixed allowlist only; no user-supplied destination URLs.
- HTTPS upstreams only.
- GET-only upstream requests; no login/session forwarding.
- Redirects are blocked.
- JSON/plain-text responses only, maximum 500 KB.
- 10-second upstream timeout and basic per-isolate rate limiting.

Only configure services you own or have permission to access.
