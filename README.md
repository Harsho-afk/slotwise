# Clinic Appointment Manager

A booking platform for a single clinic — patients book and manage their own
appointments, doctors see their schedule, and admins run the place. Built as
a portfolio piece to show a full auth + payments + role-based app done
properly, not just wired up to work.

**Stack:** React (Vite) · Node.js / Express · PostgreSQL · Prisma

## Features

- **Patients** sign up, browse doctors, book a real open slot, pay, and
  cancel or reschedule within a cutoff window
- **Doctors** see their own schedule and mark visits complete or no-show
- **Admins** create doctor accounts and availability, view/filter every
  appointment, and see basic stats (bookings this week, no-show rate)
- **Payments** run through a mock gateway behind a provider interface, with
  the same signed-webhook confirmation flow a real Razorpay/Stripe
  integration would use — see [Payments](#payments) below
- **Email** confirmations on booking and a 24h-out reminder, sent via a
  cron sweep
- Passwords hashed with argon2id, short-lived JWTs with rotating hashed
  refresh tokens, account lockout after repeated failed logins, and
  double-booking prevented at the database level, not just in app code

## Screenshots

*(add a couple of screenshots here — booking page, admin dashboard)*

## Getting started

Requires Node 20+ and PostgreSQL 16 (or Docker).

```bash
git clone <repo-url>
cd clinic-appointment-manager
```

**API**

```bash
cd server
cp .env.example .env      # fill in DATABASE_URL and the secrets
npm install
npx prisma migrate dev
npm run seed               # creates demo data — see console output for all logins
npm run dev                 # http://localhost:4000
```

**Client**

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

Sign up as a patient, or log in with the seeded admin account to add a
doctor before booking.

`npm run seed` populates the database with demo data so there's something
to look at immediately: 3 doctors (with Mon–Fri 9–5 availability already
set up), 3 patients, and a handful of appointments in different states
(completed, no-show, confirmed, awaiting payment) spread across past and
upcoming dates. All seeded accounts use a fixed password so you can log in
as any of them — printed in full at the end of the seed run.

**Or with Docker** (Postgres + API together):

```bash
docker compose up --build
```

## Project structure

```
client/          React app (Vite)
  src/pages/       route-level views
  src/components/  shared UI
  src/api/         fetch wrappers + auth token handling
  src/context/      auth context

server/          Express API
  src/routes/        route definitions
  src/controllers/   request handlers
  src/services/       payments, email, slot calculation, reminders
  src/middleware/     auth, role checks, rate limiting
  prisma/             schema + migrations + seed script
```

## API overview

All routes are versioned under `/api/v1`.

| Method | Route                          | Notes                                   |
| ------ | ------------------------------- | ---------------------------------------- |
| POST   | `/auth/signup`                  | patient self-registration                |
| POST   | `/auth/login`                   | all roles                                |
| POST   | `/auth/refresh`                 | rotates the refresh token                |
| GET    | `/doctors`                      | public                                   |
| GET    | `/doctors/:id/slots?date=`      | live availability for a given day        |
| POST   | `/appointments`                 | patient, creates a `pending_payment` row |
| POST   | `/appointments/:id/pay`         | starts a payment order                   |
| POST   | `/payments/webhook`             | gateway → server, confirms the booking   |
| DELETE | `/appointments/:id`             | patient cancel, subject to cutoff window |
| GET    | `/admin/appointments`           | admin/doctor, filterable                 |
| PATCH  | `/admin/appointments/:id`       | mark complete / no-show                  |

Full schema and design notes are in [`BUILD_SPEC.md`](./BUILD_SPEC.md).

## Payments

There's no live Razorpay/Stripe account behind this — it's a mock provider
built behind a `PaymentProvider` interface, so the parts worth demonstrating
(webhook signature verification, idempotency, never trusting the frontend to
confirm a charge) are real, just without a live gateway account:

1. `POST /appointments/:id/pay` returns `{ orderId, checkoutUrl }`, same
   shape a real gateway's order-creation call returns.
2. The client's mock checkout page stands in for the gateway's hosted
   checkout. Choosing an outcome fires an HMAC-signed webhook payload at the
   server's own `/payments/webhook` endpoint — not a direct "mark as paid"
   call.
3. The webhook handler verifies the signature and only then flips the
   appointment to `confirmed`. Replaying the same webhook is a no-op.

Swapping in a real gateway later is writing `RazorpayProvider` /
`StripeProvider` against the same interface
(`server/src/services/payment/PaymentProvider.js`) and changing one line in
`paymentService.js` — no route or controller changes.

## Environment variables

See `server/.env.example` and `client/.env.example`. The only one worth
calling out: `VITE_API_URL` on the client is only needed if the client and
API are deployed to different origins — in local dev, Vite proxies `/api`
to the backend and it can stay blank.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a concrete walkthrough (Render +
managed Postgres), including a note on why the reminder cron needs to move
to the host's scheduler if you deploy behind a scale-to-zero instance or
multiple replicas.

## Roadmap

- Waitlist for fully booked slots
- Recurring appointments
- Multi-clinic support

## License

MIT
