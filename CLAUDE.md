# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Utklädnad Lund: a peer-to-peer costume rental marketplace for students in Lund. Students list costumes, others rent them, and they meet in person for the handover. `report.tex` is the team's business plan (product context, not code). Read it, don't edit it. `README.md` documents the product decisions; keep it in sync when a rule changes.

## Commands

```bash
npm run dev                  # Next.js dev server (http://localhost:3000)
npm run build && npm start   # production build / server
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint . (`next lint` no longer exists in Next 16)
npm test                     # vitest: unit + DB integration tests
npx vitest run tests/bookings.test.ts -t "damage"   # single file / test by name
npm run setup                # prisma migrate deploy + seed (fresh checkout)
npm run db:migrate -- --name <name>   # after editing prisma/schema.prisma
npm run make-admin -- someone@example.com
```

- The Prisma client is generated into `src/generated/prisma` (gitignored, created by `postinstall`). Import it from `@/generated/prisma/client`, not `@prisma/client`. Re-run `npx prisma generate` after schema changes if the migrate command didn't.
- Prisma blocks `prisma migrate reset` (and `npm run db:reset`) when an AI agent runs it. Don't bypass the guard; ask the user to run it.
- npm here enforces `allowScripts` in `package.json`. New packages with install scripts must be approved with `npm install-scripts approve <pkg>`.
- Demo accounts after seeding: `elsa@`, `oskar@`, `amira@`, `lukas@`, `admin@example.com`, password `password123`.

## Stack notes (versions newer than most training data)

- **Next.js 16** (App Router, Turbopack, server actions). Version-matched docs are in `node_modules/next/dist/docs/`; check them before using an API you're unsure of. `params`/`searchParams`/`cookies()` are async-only. `refresh()` from `next/cache` refreshes the client router from an action.
- **Prisma 7** with the `prisma-client` generator, the better-sqlite3 driver adapter (`src/lib/db.ts`) and `prisma.config.ts`. The datasource URL lives in the config, not the schema.
- **Tailwind 4**: shared classes (`btn-primary`, `input`, `card`, …) are declared with `@utility` in `src/app/globals.css`. `@layer components` classes can't be `@apply`'d by other classes.
- **Stripe SDK 23**: Connect accounts use **Accounts v2** (`stripe.v2.core.accounts`, recipient configuration, `stripe_transfers` capability). Don't use legacy `accounts.create({ type: "express" })`, `application_fee_amount` (wrong with separate charges and transfers) or `payment_method_types`.

## Architecture

### Layering

`src/lib/*` holds all domain logic and has no Next.js imports, except `auth.ts`. That's what lets tests call it directly. `src/actions/*` are thin server actions: `requireUser()`, then run the lib function inside `toActionState()`, then `revalidatePath()`. Domain code throws `UserError` (`src/lib/errors.ts`) for messages safe to show users; anything else is a bug and propagates. Call `redirect()` *outside* the try/catch.

Client components may only import pure modules: `booking-status.ts`, `pricing.ts`, `dates.ts`, `geo.ts`, `config.ts`, `photos.ts`. Never `db.ts`, `payments.ts`, `uploads.ts` or `bookings.ts`.

### Booking state machine (`src/lib/bookings.ts`, `src/lib/booking-status.ts`)

```
REQUESTED → ACCEPTED → PAID → PICKED_UP → COMPLETED
                                PICKED_UP → DISPUTED → COMPLETED (admin)
exits: DECLINED, CANCELLED, EXPIRED
```

- Every transition goes through `transition()`, a compare-and-set `updateMany` on the expected status, so double clicks and races can't apply a step twice. Keep using it for new transitions.
- Each step posts a system message (`senderId = null`) into the booking chat, which doubles as the timeline.
- Dates reserved by ACCEPTED/PAID/PICKED_UP/DISPUTED (`BLOCKING_STATUSES`) can't be booked again. Accepting a request auto-declines overlapping requests.
- Prices are snapshotted on the booking at request time (`rentalAmount`, `depositAmount`, `platformFee`, `ownerPayout`). Listing edits don't affect existing bookings.

### Money (`src/lib/payments.ts` + `settleBooking`)

- The platform is merchant of record, using Stripe separate charges and transfers. The renter pays rental + deposit via Checkout. The owner's share is transferred (with `source_transaction`) at pickup. The deposit is refunded at completion or split by an admin's claim decision. Cancelling before pickup refunds everything.
- Status changes never move money directly. `dueMoneyOps(booking)` derives which movements the status implies and that haven't happened yet (null Stripe id). `settleBooking()` runs them with idempotency keys `booking-<id>-<kind>` and stores the ids. Failures land in `settlementError` and are retried by the sweep. To add a money movement: add a `MoneyOp` kind, a column for its Stripe id, and a case in `runMoneyOp`.
- `getPayments()` returns the real Stripe adapter when `STRIPE_SECRET_KEY` is set, otherwise `MockPayments` (demo mode: `/mock-checkout/[id]` stands in for Stripe Checkout). Tests inject a fake with `setPaymentsForTesting()`.
- Payment is confirmed by the webhook (`src/app/api/stripe/webhook/route.ts`) and, redundantly, by the success redirect (`/bookings/[id]/paid`). Both go through `recordPayment()`, which is idempotent and refunds payments that arrive after a booking was closed.
- Owners must have Stripe transfers active to accept. `refreshPayoutStatus()` re-checks Stripe when the cached `payoutsEnabled` is false.

### Time-based rules

`sweepBookings(now)` expires unanswered/unpaid bookings, auto-confirms pickup and auto-completes returns, then retries pending settlements. It's triggered by `maybeSweep()` (throttled to once a minute per process) on booking pages, by `/api/cron/sweep` (Bearer `CRON_SECRET`), and from the admin page. Durations live in `src/lib/config.ts`.

### Conventions that are easy to break

- **Amounts are whole SEK integers everywhere.** Conversion to öre happens only inside `payments.ts`.
- **Dates are `YYYY-MM-DD` strings in Europe/Stockholm time** (`todayISO()`), compared lexicographically. Rental ranges are half-open `[startDate, endDate)`, so a return day can be the next pickup day. `days = endDate − startDate`.
- **Exact location is private.** `Listing.lat/lng` is the owner's pin, shown only to the owner and to the renter once paid. Everything public uses `publicLat/publicLng`, a random offset stored at save time. Never pass a whole `Listing` row to a client component; pass only the fields it needs.
- **Forms:** React 19 resets a `<form action={…}>` after submit, wiping input on validation errors. Forms that can fail use `onSubmit={submitWithoutReset(formAction)}` from `src/components/forms.tsx`, with `pending` from `useActionState` passed to `SubmitButton`.
- **Maps:** Leaflet touches `window`. Always render maps through `src/components/map/CostumeMap.tsx` (dynamic import, `ssr: false`).
- **Uploads** go to `UPLOAD_DIR` (local disk) with random names validated by regex, and are served by `/api/uploads/[name]`. Formats are checked by magic bytes, not the browser-supplied type.
- Auth is a custom session cookie (SHA-256 of the token stored in `Session`) plus scrypt passwords. `getCurrentUser()` is `cache()`d per request.

## Tests

`tests/global-setup.ts` recreates `test.db` with `prisma migrate deploy` on every run. Integration tests share that file (`fileParallelism: false`), and `tests/bookings.test.ts` wipes all tables in `beforeEach`, because the sweep acts on every booking in the database. Use `sweepBookings(new Date(future))` to simulate time passing rather than mocking the clock.
