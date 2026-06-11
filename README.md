# DA Scorecard HQ — Breez Global Logistics

Password-protected driver performance dashboard for station DTG5 (DSP: BRGL).
Live at scorecard.breezglobalgroup.com (Vercel).

## Structure

- Next.js 14 app (this repo root)
- `data/data.json` — generated dataset the site reads
- `scripts/build-data.mjs` — rebuilds data.json from raw portal CSVs (kept locally, not in repo)

## Refreshing data

Claude (Cowork) pulls fresh CSVs from logistics.amazon.com daily — current day +
current week only — regenerates `data/data.json`, and pushes it here, which
triggers a Vercel redeploy automatically.

## Password

Set via the `SITE_PASSWORD` env var on Vercel (falls back to the value in
`lib/password.js`). Changing it invalidates existing sessions.

## Coaching reports

Built under /coaching. Share links are self-contained (report encoded in the
URL) and viewable without the site password so they can be sent straight to a
DA. Use Print / Save PDF on the report page for signatures.
