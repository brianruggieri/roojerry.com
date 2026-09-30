# Caching HTML at the Cloudflare edge

## Why

roojerry.com is already behind Cloudflare, but **Cloudflare does not cache HTML
by default** — it treats it as dynamic. Every page view therefore goes to the
origin, even though every URL on this site is a static Hugo build artifact.

Measured from Atlanta, 2026-09-29:

| Resource | `cf-cache-status` | TTFB |
|---|---|---|
| `/` (HTML) | `DYNAMIC` | 0.411s / 0.310s / 0.402s |
| `/css/design-system.css` | `HIT` | 0.069s / 0.079s |

A Chrome DevTools trace of the live site put LCP at 311 ms, of which **244 ms
was TTFB** and 67 ms was render delay. The LCP element is the `<h1 class="mb-0">`
name text — not an image:

```
tag: H1, class: "mb-0", text: "BRIANRUGGIERI", url: null, size: 29747
```

Because LCP is text, image optimisation cannot move it. **TTFB is the only
lever on this page**, and roughly 250–330 ms of it is avoidable.

## The rule to create

Cloudflare dashboard → the zone → **Caching → Cache Rules → Create rule**.

- **Name:** `Cache static HTML`
- **When incoming requests match:** `Hostname equals www.roojerry.com`
  (or leave the expression matching all requests — every path this site serves
  is a build artifact)
- **Cache eligibility:** `Eligible for cache`
- **Edge TTL:** `Ignore cache-control header and use this TTL` → a long value
  (e.g. 1 month). The deploy purges on every push, so the TTL is a backstop,
  not the freshness mechanism.
- **Browser TTL:** `Respect origin TTL`, or a short value (e.g. 5 minutes).
  Keep this short — a long browser TTL is *not* purgeable and will strand
  visitors on an old build.

The asymmetry matters: edge TTL can be long because a purge can clear it;
browser TTL cannot be purged, so it stays short.

## The API token

`.github/workflows/deploy.yml` purges the cache after each rsync. It needs two
repository secrets:

- `CLOUDFLARE_ZONE_ID` — zone overview page, right-hand sidebar.
- `CLOUDFLARE_API_TOKEN` — **My Profile → API Tokens → Create Token**, using
  the *Zone → Cache Purge* template, scoped to this zone only. Not the Global
  API Key, which carries full account access.

The purge step fails the build if either secret is missing or if Cloudflare
returns `"success": false`. That is deliberate: a silent purge failure serves
the previous build to every visitor until the edge TTL expires, which is the
one failure mode that makes this change worse than not doing it.

## Verifying

After a deploy:

```bash
curl -sSI https://www.roojerry.com/ | grep -i 'cf-cache-status\|age'
```

First request after a purge is `MISS`; subsequent ones should be `HIT`. To
confirm the TTFB win:

```bash
curl -sS -o /dev/null -w 'ttfb=%{time_starttransfer}s status=%{http_code}\n' \
  https://www.roojerry.com/
```

Compare against the 0.31–0.41s baseline above. Re-run PSI afterwards; mobile
was 90/100/100/100 and desktop 100/100/100/100 before this change.

## Notes

- Trust the PageSpeed Insights web UI for scores, not local Lighthouse runs —
  local runs on this machine have been measured swinging 50–82 on the same URL.
- `purge_everything` is used rather than a URL list because a Hugo build can
  change any page (nav, footer, JSON-LD are emitted into every file).
