# PROXY — Service Gateway

A small Node.js gateway for APIs and web services you own or are authorized to access. The frontend is served by the backend; its CSS, JavaScript, and SVG brand asset are loaded from jsDelivr.

## What is included

- Responsive frontend dashboard with backend health status.
- Configured-service list populated from the backend.
- Read-only GET endpoint tester.
- Allowlisted upstreams only — no arbitrary destination URL input.
- GET and HEAD forwarding only, redirect blocking, request timeout, and basic per-IP rate limiting.
- Static frontend assets delivered through jsDelivr.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
ALLOWED_ORIGINS='{"demo":"https://httpbin.org"}' npm start
```

Open `http://localhost:3000`. Check `/health` for backend status.

The `ALLOWED_ORIGINS` value is a JSON object mapping short target names to fixed HTTPS origins. For example:

```json
{"status-api":"https://api.example.com"}
```

The frontend will list `status-api`. Use the request console with a relative path such as `v1/status`; the resulting gateway path is `/p/status-api/v1/status`.

## jsDelivr asset URLs

These files are in this public GitHub repository and are delivered by jsDelivr:

- CSS: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/app.css
- JavaScript: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/app.js
- SVG mark: https://cdn.jsdelivr.net/gh/jjaidenn/PROXY@main/public/assets/mark.svg

The HTML references these CDN URLs directly. The HTML page and API still need to be served by the running Node.js backend so same-origin API requests work.

## Deploying the backend

jsDelivr is a static CDN; it cannot execute `server.js`. Deploy this repository to a Node.js host that supports Node 20+, set the start command to `npm start`, and configure the `ALLOWED_ORIGINS` environment variable there. Set the host's health-check path to `/health` if it supports health checks.

Do not put secrets in the frontend or in `ALLOWED_ORIGINS` values. The gateway intentionally does not forward cookies or authorization headers. Do not configure private services unless you add a proper authentication layer first.

## Important limitations

This is an allowlisted API/service gateway, not a full browser proxy. It does not rewrite arbitrary webpages, forward login sessions, or bypass access controls. Only GET and HEAD requests are enabled. The current rate limiter is in-memory and resets when the process restarts; use a shared limiter and authentication before exposing sensitive services publicly.

Only connect services you own or have permission to access.
