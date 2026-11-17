# PROXY

A small allowlisted reverse-proxy starter for APIs and web services you own or are authorized to proxy.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Set `ALLOWED_ORIGINS` to a JSON object mapping short names to upstream origins.
4. Run `npm start`.

Example:

```sh
ALLOWED_ORIGINS='{"my-service":"https://api.example.com"}' npm start
```

Check `/health` and `/api/targets`. A configured target is reachable at:

```
/p/my-service/v1/status
```

## Configuration

- `PORT`: listening port (defaults to 3000).
- `ALLOWED_ORIGINS`: JSON map of target names to fixed HTTPS origins.

The server intentionally does not accept arbitrary destination URLs, does not forward cookies or authorization headers, and blocks upstream redirects. This prevents it from becoming an unrestricted public proxy. Add authentication and per-user rate limits before exposing sensitive upstream services publicly.

## License notes

This repository is a new implementation. Before incorporating code from third-party projects, review each project's actual source, license, attribution requirements, and dependencies. Do not copy code whose license or provenance is unclear.
