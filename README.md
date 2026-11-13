# Utklädnad Lund

Peer-to-peer costume rentals for students in Lund. Students list costumes they own, others rent them for a party or sittning, and the two meet up to hand the costume over. The platform takes a 10% commission on each rental.

Built with Next.js 16 (App Router, server actions), Prisma 7 + SQLite, Tailwind CSS 4, Stripe Connect, and Leaflet/OpenStreetMap.

## Quick start

```bash
npm install
cp .env.example .env
npm run setup      # create the database and load demo data
npm run dev        # http://localhost:3000
```

With `STRIPE_SECRET_KEY` empty the app runs in **demo mode**: payments, payouts and refunds are simulated, and a banner says so. Everything else works for real.

Demo accounts (password `password123`): `elsa@`, `oskar@`, `amira@` (owners), `lukas@` (renter), `admin@` — all `@example.com`.

## How it works

| Decision | Choice |
| --- | --- |
| Model | Peer-to-peer: students list their own costumes |
| Handover | In person; renter and owner arrange it in the booking chat |
| Pricing | Flat price per rental covering N days (owner's choice), optional price per extra day |
| Commission | 10% of the rental, deducted from the owner's share (`PLATFORM_FEE_PERCENT`). Never taken from deposits |
| Booking | Renter requests dates → owner accepts → renter pays within 48 h |
| Deposit | Owner-set, charged with the rental, refunded when the owner confirms the return |
| Owner payout | When the renter confirms pickup (or automatically 2 days after the pickup date) |
| Cancellation | Full refund if cancelled before pickup, by either side |
| Damage | Owner claims up to the deposit; an admin decides the split |
| Location | Owner drops a map pin. The public page shows a randomly offset ~400 m circle; the exact pin is revealed once paid |
| Sign-up | Open, email + password |

### Booking lifecycle

```
REQUESTED ─accept→ ACCEPTED ─pay→ PAID ─renter confirms pickup→ PICKED_UP ─owner confirms return→ COMPLETED
                                                                 PICKED_UP ─report damage→ DISPUTED ─admin→ COMPLETED
Side exits: DECLINED, CANCELLED (full refund if paid), EXPIRED (unanswered / unpaid)
```

Timeouts are applied by a sweep (`sweepBookings` in `src/lib/bookings.ts`) that runs at most once a minute when booking pages are viewed, and on demand via `POST /api/cron/sweep` with `Authorization: Bearer $CRON_SECRET`. Schedule that endpoint (e.g. every 15 min) in production so timeouts happen even when nobody is browsing.

### Money flow

The platform is the merchant of record and uses Stripe Connect **separate charges and transfers**:

1. Renter pays rental + deposit via Stripe Checkout to the platform account.
2. On pickup, the owner's share (rental − commission) is transferred to their connected account.
3. On return, the deposit is refunded to the renter, or split per the admin's damage decision.
4. Cancelling before pickup refunds everything. Nothing has been transferred yet, so there's nothing to claw back.

Every state change is a compare-and-set on the booking status, and every money movement is recorded and executed with a Stripe idempotency key by `settleBooking()`. A failed payout or refund is retried by the sweep without paying twice. Stuck ones are listed on `/admin`.

## Going live with Stripe

1. Create a Stripe [sandbox](https://docs.stripe.com/sandboxes) for development and enable Connect. Prefer a [restricted API key](https://docs.stripe.com/keys#manage-your-api-keys) (`rk_…`) with access to Checkout Sessions, Refunds, Transfers, Accounts and Account Links.
2. Set `STRIPE_SECRET_KEY`, `APP_URL` and `STRIPE_WEBHOOK_SECRET` in `.env`.
3. Add a webhook endpoint at `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. **The webhook is required**, because it's what confirms payments when a renter closes the tab after paying.
4. Enable the payment methods you want, e.g. Swish and Klarna, in the Dashboard. The code uses dynamic payment methods, so no code change is needed.

Owners are onboarded as Accounts v2 recipients (Express dashboard, `stripe_transfers` capability) from `/account`. Payout readiness is re-checked against Stripe when they try to accept a request.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit + integration tests (lifecycle, money movements, timeouts) against a throwaway SQLite DB |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run setup` | Apply migrations and seed demo data |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:reset` | Wipe the database and re-seed |
| `npm run make-admin -- you@example.com` | Grant admin access |

## Project layout

```
prisma/schema.prisma      data model
src/lib/bookings.ts       booking state machine, settlement, sweep
src/lib/booking-status.ts statuses + which money movements are due (pure, client-safe)
src/lib/payments.ts       Stripe adapter + demo-mode mock
src/lib/listings.ts       listing validation, photo handling, search with distance sort
src/actions/              server actions (auth checks + thin wrappers around lib/)
src/app/                  pages and route handlers (webhook, uploads, cron)
tests/                    vitest suites
```

## Before launch

- **Photos** are stored on local disk (`UPLOAD_DIR`). Move them to object storage (S3/R2) if you deploy to more than one server or to serverless hosting.
- **SQLite** is fine for a pilot on a single server. For more, switch the Prisma datasource to Postgres.
- **Email notifications** aren't implemented. Users see a badge on "Bookings" in the app. Owners will want an email for new requests.
- **Login rate limiting** and **password reset** are not implemented yet.
- **OpenStreetMap tiles** come from the public tile server, which is fine for a pilot. Use a tile provider if traffic grows.
- **Known trust gap:** a renter can cancel a paid booking until pickup is confirmed. A dishonest renter could take the costume and then cancel. Owners are told to ask for the "I've got the costume" tap at the handover; admins can see the chat if it's disputed.
- **Optional insurance** (from the business plan) isn't built. Owners can already enter a costume's value, which the insurance pricing could use.
