# Deployment

Concrete steps against the checklist in `BUILD_SPEC.md` §8. Uses Render for
the API (it's straightforward for a Node+Postgres app with a Dockerfile
already written) and any static host for the client — swap in your
preferred provider, the steps are the same shape.

## 1. Database — managed Postgres, not self-hosted

Use a managed provider: [Neon](https://neon.tech), [Supabase](https://supabase.com),
or [Render's Postgres](https://render.com/docs/databases). All three give you
automated backups out of the box, which the checklist calls for explicitly.

1. Create a Postgres instance, note the connection string.
2. You'll run migrations against it once the API is deployed (step 3.4) —
   don't run `prisma migrate dev` against production; that's for local dev.

## 2. Client environment

The client has no secrets — everything it needs is `VITE_API_URL`, which
you'll only need if the client and API end up on different origins (they
will, in this setup).

## 3. API — Render (or any host that runs a Dockerfile)

The repo already has `server/Dockerfile`, which runs `prisma migrate deploy`
before starting the server, so migrations apply automatically on every
deploy.

1. **New Web Service** on Render, point it at this repo, root directory
   `server/`, build with the existing Dockerfile.
2. **Environment variables** (Render → Environment tab) — same names as
   `server/.env.example`, with real values:
   - `DATABASE_URL` — from step 1
   - `JWT_ACCESS_SECRET` — generate with `openssl rand -hex 32`, don't reuse
     across environments
   - `JWT_ACCESS_EXPIRES_IN` — `15m`
   - `JWT_REFRESH_EXPIRES_IN_DAYS` — `7`
   - `PAYMENT_WEBHOOK_SECRET` — generate the same way, independent secret
   - `NODE_ENV` — `production`
   - `CLIENT_ORIGIN` — the client's real deployed URL (step 4) — CORS is
     locked to exactly this, not `*`
   - `PORT` — Render sets this for you; the app already reads `process.env.PORT`
   - SMTP vars if you want real reminder/confirmation emails instead of the
     console-log dev fallback (`server/src/services/email.js`)
3. Render terminates TLS for you, so "HTTPS only, redirect at the load
   balancer" is handled by the platform — nothing to configure in Express.
4. Deploy. Watch the build logs for `prisma migrate deploy` running
   cleanly — that's your schema landing on the real database.
5. Hit `GET https://<your-api>/health` — should return `{"status":"ok"}`.
   Point your host's uptime monitor at this URL.
6. Seed an admin account once, against production:
   ```bash
   # from your machine, pointed at the prod DATABASE_URL
   SEED_ADMIN_EMAIL=you@clinic.com SEED_ADMIN_PASSWORD='something-strong' \
     DATABASE_URL="<prod connection string>" node server/prisma/seed.js
   ```
   Log in and change that password immediately — the seed script prints a
   reminder for exactly this reason.

## 4. Client — Vercel/Netlify/Render static site

1. Root directory `client/`, build command `npm run build`, output
   directory `dist/`.
2. Set `VITE_API_URL` to the API's production URL if you didn't keep the
   dev-only Vite proxy — in production the client and API are on different
   domains, so `client/src/api/client.js`'s `apiFetch` should prefix
   requests with it instead of relying on the `/api` proxy that only exists
   in `vite.config.js`'s dev server.
3. Deploy, then go back to the API's `CLIENT_ORIGIN` env var and set it to
   this exact URL (step 3.2) — CORS will reject everything until this
   matches.

## 5. Reminder job — a real note on the in-process cron

`server/src/services/reminderJob.js` uses `node-cron` inside the same
process as the API. That's fine on a host that keeps one instance running
continuously (a Render Web Service, a VPS, etc.) but **will not fire
reliably** on:
- anything that scales to zero or sleeps when idle
- multiple API instances behind a load balancer (you'd get duplicate sends
  — there's no distributed lock here)

If you deploy behind either of those, move the sweep to the host's own
scheduler instead of relying on the in-process cron:
- Render → **Cron Jobs** feature, hitting a small authenticated endpoint
  that calls `runReminderSweep()` (exported from `reminderJob.js` for
  exactly this reason)
- or a GitHub Actions scheduled workflow / any external cron hitting the
  same endpoint

## 6. Payment webhook — production URL matters

The checklist's reminder about the webhook applies literally here: if you
ever swap `MockProvider` for a real gateway, its dashboard needs the
**production** webhook URL (`https://<your-api>/api/v1/payments/webhook`)
registered, not `localhost`. Nothing to do for the mock provider itself —
it already calls its own production URL correctly since it builds the URL
from the incoming request (`paymentController.js`'s `simulateMockPayment`).

## 7. Final pass before going live

Straight from `BUILD_SPEC.md` §8 — re-verify against what's actually deployed:

- [ ] `NODE_ENV=production` set on the API
- [ ] All secrets are in the host's env config, not committed (`.env` is
      gitignored — double check nothing slipped in with `git log --all --full-history -- server/.env`)
- [ ] Postgres is managed with automated backups (step 1)
- [ ] `CLIENT_ORIGIN` on the API exactly matches the deployed client URL
- [ ] `npm audit` clean in both `server/` and `client/` (or documented,
      accepted risk)
- [ ] Confirm production error responses don't leak stack traces — the
      error handler in `server/src/app.js` already gates the `stack` field
      behind `NODE_ENV !== "production"`, just verify the env var is
      actually set on the host
- [ ] `GET /health` returns 200 from the public URL
- [ ] Run the full flow end-to-end against production: sign up → book a
      slot → mock checkout success → appointment shows `confirmed` → admin
      dashboard shows it → mark complete
