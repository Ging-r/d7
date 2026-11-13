import type { Prisma } from "@/generated/prisma/client";
import {
  BLOCKING_STATUSES,
  BookingStatus,
  CLOSED_STATUSES,
  PICKED_UP_STATUSES,
  dueMoneyOps,
  type MoneyOp,
} from "./booking-status";
import {
  AUTO_PICKUP_AFTER_DAYS,
  DAMAGE_REPORT_DAYS,
  MAX_DAYS_AHEAD,
  MAX_RENTAL_DAYS,
  PAYMENT_WINDOW_HOURS,
  PLATFORM_FEE_PERCENT,
} from "./config";
import { addDays, daysBetween, formatDate, formatDateRange, isISODate, todayISO } from "./dates";
import { db } from "./db";
import { UserError } from "./errors";
import { getPayments } from "./payments";
import { refreshPayoutStatus } from "./payouts";
import { formatSEK, maxRentalDays, quote } from "./pricing";

type Tx = Prisma.TransactionClient;
type Role = "renter" | "owner";

// ---------------------------------------------------------------------------
// Helpers

export function validateRentalDates(startDate: string, endDate: string, maxDays: number, today = todayISO()): number {
  if (!isISODate(startDate) || !isISODate(endDate)) throw new UserError("Choose a pickup and a return date.");
  if (startDate < today) throw new UserError("The pickup date can't be in the past.");
  if (daysBetween(today, startDate) > MAX_DAYS_AHEAD) {
    throw new UserError(`You can book at most ${MAX_DAYS_AHEAD} days ahead.`);
  }
  const days = daysBetween(startDate, endDate);
  if (days < 1) throw new UserError("The return date must be after the pickup date.");
  if (days > maxDays) throw new UserError(`This costume can be rented for at most ${maxDays} ${maxDays === 1 ? "day" : "days"}.`);
  return days;
}

export async function hasConflict(
  listingId: string,
  startDate: string,
  endDate: string,
  excludeBookingId?: string,
  tx: Tx = db,
): Promise<boolean> {
  const count = await tx.booking.count({
    where: {
      listingId,
      status: { in: BLOCKING_STATUSES },
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
  return count > 0;
}

export function paymentDeadline(acceptedAt: Date): Date {
  return new Date(acceptedAt.getTime() + PAYMENT_WINDOW_HOURS * 3_600_000);
}

/** Compare-and-set on status, so double clicks and races can't apply a transition twice. */
async function transition(
  id: string,
  from: BookingStatus | BookingStatus[],
  data: Prisma.BookingUncheckedUpdateManyInput,
  tx: Tx = db,
): Promise<boolean> {
  const result = await tx.booking.updateMany({
    where: { id, status: { in: Array.isArray(from) ? from : [from] } },
    data,
  });
  return result.count === 1;
}

async function systemMessage(bookingId: string, body: string, tx: Tx = db) {
  await tx.message.create({ data: { bookingId, body } });
}

async function loadAs(userId: string, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new UserError("Booking not found.");
  const role: Role | null = booking.renterId === userId ? "renter" : booking.ownerId === userId ? "owner" : null;
  if (!role) throw new UserError("Booking not found.");
  return { booking, role };
}

const STALE = "This booking changed in the meantime. Reload the page and try again.";

// ---------------------------------------------------------------------------
// Renter: request, pay, confirm pickup

export async function requestBooking(input: {
  renterId: string;
  listingId: string;
  startDate: string;
  endDate: string;
  message: string;
}): Promise<string> {
  const listing = await db.listing.findUnique({ where: { id: input.listingId } });
  if (!listing || !listing.active) throw new UserError("This costume isn't available right now.");
  if (listing.ownerId === input.renterId) throw new UserError("You can't rent your own costume.");

  const days = validateRentalDates(input.startDate, input.endDate, maxRentalDays(listing, MAX_RENTAL_DAYS));
  if (await hasConflict(listing.id, input.startDate, input.endDate)) {
    throw new UserError("Those dates are already booked. Try other dates.");
  }

  const q = quote(listing, days, PLATFORM_FEE_PERCENT);
  const now = Date.now();
  const message = input.message.trim().slice(0, 2000);
  const booking = await db.booking.create({
    data: {
      listingId: listing.id,
      renterId: input.renterId,
      ownerId: listing.ownerId,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      rentalAmount: q.rentalAmount,
      depositAmount: q.depositAmount,
      platformFee: q.platformFee,
      ownerPayout: q.ownerPayout,
      status: BookingStatus.REQUESTED,
      renterLastReadAt: new Date(now + 1),
      messages: {
        create: [
          { body: `Rental requested for ${formatDateRange(input.startDate, input.endDate)}.`, createdAt: new Date(now) },
          ...(message ? [{ senderId: input.renterId, body: message, createdAt: new Date(now + 1) }] : []),
        ],
      },
    },
  });
  return booking.id;
}

/** Returns the URL to send the renter to for payment. */
export async function startCheckout(renterId: string, bookingId: string): Promise<string> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { listing: true, renter: true },
  });
  if (!booking || booking.renterId !== renterId) throw new UserError("Booking not found.");
  if (booking.status !== BookingStatus.ACCEPTED) throw new UserError("This booking isn't waiting for payment.");
  const deadline = paymentDeadline(booking.acceptedAt!);
  if (deadline <= new Date() || booking.startDate < todayISO()) {
    await sweepBookings();
    throw new UserError("The payment window for this booking has closed.");
  }

  const payments = getPayments();
  if (booking.checkoutSessionId && payments.mode === "stripe") {
    const existing = await payments.getCheckout(booking.checkoutSessionId);
    if (existing.paid) {
      await confirmCheckoutSession(booking.checkoutSessionId);
      throw new UserError("This booking has already been paid.");
    }
    // Reuse an open session so the renter can't end up paying twice.
    if (existing.open && existing.url) return existing.url;
  }

  const session = await payments.createCheckout({
    bookingId: booking.id,
    title: booking.listing.title,
    days: booking.days,
    rentalAmount: booking.rentalAmount,
    depositAmount: booking.depositAmount,
    customerEmail: booking.renter.email,
    expiresAt: deadline,
  });
  await db.booking.update({ where: { id: booking.id }, data: { checkoutSessionId: session.id } });
  return session.url;
}

/** Looks up a Stripe Checkout session and records its payment. Used by the webhook and the success redirect. */
export async function confirmCheckoutSession(sessionId: string): Promise<string | null> {
  const info = await getPayments().getCheckout(sessionId);
  if (!info.paid || !info.bookingId || !info.paymentIntentId) return info.bookingId;
  await recordPayment({
    bookingId: info.bookingId,
    sessionId,
    paymentIntentId: info.paymentIntentId,
    chargeId: info.chargeId,
  });
  return info.bookingId;
}

export async function recordPayment(input: {
  bookingId: string;
  sessionId: string;
  paymentIntentId: string;
  chargeId: string | null;
}) {
  const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) {
    console.error(`[payments] payment ${input.paymentIntentId} for unknown booking ${input.bookingId}`);
    return;
  }
  if (booking.paymentIntentId === input.paymentIntentId) return; // already recorded

  const paid = await db.booking.updateMany({
    where: { id: booking.id, status: BookingStatus.ACCEPTED, paymentIntentId: null },
    data: {
      status: BookingStatus.PAID,
      paidAt: new Date(),
      checkoutSessionId: input.sessionId,
      paymentIntentId: input.paymentIntentId,
      chargeId: input.chargeId,
    },
  });
  if (paid.count === 1) {
    await systemMessage(
      booking.id,
      `Payment received (${formatSEK(booking.rentalAmount + booking.depositAmount)}). The booking is confirmed – agree on a time and place to meet here in the chat. Renter: tap "I've got the costume" when you receive it.`,
    );
    return;
  }

  // The booking was cancelled, expired or already paid before this payment
  // went through, so give the money straight back.
  await getPayments().refund({
    paymentIntentId: input.paymentIntentId,
    amount: booking.rentalAmount + booking.depositAmount,
    idempotencyKey: `orphan-payment-${input.paymentIntentId}`,
  });
  await systemMessage(booking.id, "A payment arrived after this booking was closed, so it was refunded in full.");
}

export async function notePaymentFailed(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (booking?.status === BookingStatus.ACCEPTED) {
    await systemMessage(bookingId, "The payment didn't go through. The renter can try again before the payment window closes.");
  }
}

export async function confirmPickup(renterId: string, bookingId: string) {
  const { booking, role } = await loadAs(renterId, bookingId);
  if (role !== "renter") throw new UserError("Only the renter can confirm pickup.");
  if (booking.status !== BookingStatus.PAID) throw new UserError("This booking isn't waiting for pickup.");
  if (!(await transition(booking.id, BookingStatus.PAID, { status: BookingStatus.PICKED_UP, pickedUpAt: new Date() }))) {
    throw new UserError(STALE);
  }
  await systemMessage(
    booking.id,
    `The renter confirmed pickup. The owner's payout of ${formatSEK(booking.ownerPayout)} is on its way. Return the costume by ${formatDate(booking.endDate)}.`,
  );
  await settleBooking(booking.id);
}

// ---------------------------------------------------------------------------
// Owner: accept/decline, confirm return, report damage

export async function acceptBooking(ownerId: string, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { owner: true } });
  if (!booking || booking.ownerId !== ownerId) throw new UserError("Booking not found.");
  if (booking.status !== BookingStatus.REQUESTED) throw new UserError("This request can no longer be accepted.");
  if (!booking.owner.payoutsEnabled && !(await refreshPayoutStatus(booking.owner))) {
    throw new UserError("Set up payouts on your account page before accepting requests, so you can get paid.");
  }
  if (booking.startDate < todayISO()) throw new UserError("The pickup date has already passed.");

  await db.$transaction(async (tx) => {
    if (await hasConflict(booking.listingId, booking.startDate, booking.endDate, booking.id, tx)) {
      throw new UserError("You've already accepted another booking for some of these dates.");
    }
    if (!(await transition(booking.id, BookingStatus.REQUESTED, { status: BookingStatus.ACCEPTED, acceptedAt: new Date() }, tx))) {
      throw new UserError(STALE);
    }
    await systemMessage(
      booking.id,
      `Request accepted! The renter has ${PAYMENT_WINDOW_HOURS} hours to pay to confirm the booking.`,
      tx,
    );

    // Other requests for overlapping dates can't be fulfilled anymore.
    const overlapping = await tx.booking.findMany({
      where: {
        listingId: booking.listingId,
        status: BookingStatus.REQUESTED,
        startDate: { lt: booking.endDate },
        endDate: { gt: booking.startDate },
      },
      select: { id: true },
    });
    for (const other of overlapping) {
      if (await transition(other.id, BookingStatus.REQUESTED, { status: BookingStatus.DECLINED }, tx)) {
        await systemMessage(other.id, "Sorry – the costume was booked by someone else for overlapping dates.", tx);
      }
    }
  });
}

export async function declineBooking(ownerId: string, bookingId: string) {
  const { booking, role } = await loadAs(ownerId, bookingId);
  if (role !== "owner") throw new UserError("Only the owner can decline a request.");
  if (!(await transition(booking.id, BookingStatus.REQUESTED, { status: BookingStatus.DECLINED }))) {
    throw new UserError("This request can no longer be declined.");
  }
  await systemMessage(booking.id, "The owner declined the request.");
}

export async function confirmReturn(ownerId: string, bookingId: string) {
  const { booking, role } = await loadAs(ownerId, bookingId);
  if (role !== "owner") throw new UserError("Only the owner can confirm the return.");
  if (booking.status !== BookingStatus.PICKED_UP) throw new UserError("This booking isn't waiting for a return.");
  if (!(await transition(booking.id, BookingStatus.PICKED_UP, { status: BookingStatus.COMPLETED, completedAt: new Date() }))) {
    throw new UserError(STALE);
  }
  await systemMessage(
    booking.id,
    booking.depositAmount > 0
      ? `The owner confirmed the costume came back in good condition. The deposit (${formatSEK(booking.depositAmount)}) has been refunded.`
      : "The owner confirmed the costume came back in good condition.",
  );
  await settleBooking(booking.id);
}

export async function reportDamage(ownerId: string, bookingId: string, amount: number, reason: string) {
  const { booking, role } = await loadAs(ownerId, bookingId);
  if (role !== "owner") throw new UserError("Only the owner can report damage.");
  if (booking.status !== BookingStatus.PICKED_UP) throw new UserError("Damage can only be reported while the costume is rented out.");
  if (booking.depositAmount <= 0) throw new UserError("There is no deposit on this booking to claim from.");
  if (!Number.isInteger(amount) || amount < 1 || amount > booking.depositAmount) {
    throw new UserError(`Claim between 1 and ${formatSEK(booking.depositAmount)}.`);
  }
  const text = reason.trim();
  if (text.length < 10) throw new UserError("Describe the damage in a sentence or two.");

  if (
    !(await transition(booking.id, BookingStatus.PICKED_UP, {
      status: BookingStatus.DISPUTED,
      claimAmount: amount,
      claimReason: text.slice(0, 2000),
    }))
  ) {
    throw new UserError(STALE);
  }
  await systemMessage(
    booking.id,
    `The owner reported damage and claims ${formatSEK(amount)} of the deposit: "${text.slice(0, 500)}". An admin will review the claim. Renter: add your side of the story here in the chat.`,
  );
}

// ---------------------------------------------------------------------------
// Either party

export async function cancelBooking(userId: string, bookingId: string) {
  const { booking, role } = await loadAs(userId, bookingId);
  const allowed: BookingStatus[] =
    role === "renter"
      ? [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.PAID]
      : [BookingStatus.ACCEPTED, BookingStatus.PAID];
  const from = booking.status as BookingStatus;
  if (!allowed.includes(from)) throw new UserError("This booking can't be cancelled anymore.");

  if (
    !(await transition(booking.id, from, {
      status: BookingStatus.CANCELLED,
      cancelledById: userId,
      cancelledAt: new Date(),
    }))
  ) {
    throw new UserError(STALE);
  }
  const who = role === "renter" ? "the renter" : "the owner";
  await systemMessage(
    booking.id,
    from === BookingStatus.PAID
      ? `Booking cancelled by ${who}. The full amount (${formatSEK(booking.rentalAmount + booking.depositAmount)}) is being refunded to the renter.`
      : `Booking cancelled by ${who}.`,
  );
  if (from === BookingStatus.PAID) await settleBooking(booking.id);
}

export async function postMessage(userId: string, bookingId: string, body: string) {
  const { booking, role } = await loadAs(userId, bookingId);
  const text = body.trim();
  if (!text) throw new UserError("Write a message first.");
  if (text.length > 2000) throw new UserError("Messages can be at most 2000 characters.");
  const now = new Date();
  await db.$transaction([
    db.message.create({ data: { bookingId: booking.id, senderId: userId, body: text, createdAt: now } }),
    db.booking.update({
      where: { id: booking.id },
      data: role === "renter" ? { renterLastReadAt: now } : { ownerLastReadAt: now },
    }),
  ]);
}

export async function markRead(userId: string, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { renterId: true, ownerId: true } });
  if (!booking) return;
  const now = new Date();
  if (booking.renterId === userId) await db.booking.update({ where: { id: bookingId }, data: { renterLastReadAt: now } });
  else if (booking.ownerId === userId) await db.booking.update({ where: { id: bookingId }, data: { ownerLastReadAt: now } });
}

export async function submitReview(authorId: string, bookingId: string, rating: number, comment: string) {
  const { booking, role } = await loadAs(authorId, bookingId);
  if (booking.status !== BookingStatus.COMPLETED) throw new UserError("You can review once the rental is completed.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new UserError("Pick a rating from 1 to 5 stars.");
  const existing = await db.review.findUnique({ where: { bookingId_authorId: { bookingId, authorId } } });
  if (existing) throw new UserError("You've already reviewed this rental.");
  await db.review.create({
    data: {
      bookingId,
      authorId,
      subjectId: role === "renter" ? booking.ownerId : booking.renterId,
      rating,
      comment: comment.trim().slice(0, 1000),
    },
  });
}

// ---------------------------------------------------------------------------
// Admin

export async function resolveClaim(bookingId: string, ownerAmount: number, note: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== BookingStatus.DISPUTED) throw new UserError("This booking has no open damage claim.");
  const max = booking.claimAmount ?? 0;
  if (!Number.isInteger(ownerAmount) || ownerAmount < 0 || ownerAmount > max) {
    throw new UserError(`The owner can be awarded between 0 and ${formatSEK(max)}.`);
  }
  if (
    !(await transition(booking.id, BookingStatus.DISPUTED, {
      status: BookingStatus.COMPLETED,
      completedAt: new Date(),
      claimPaidAmount: ownerAmount,
      resolutionNote: note.trim().slice(0, 2000),
    }))
  ) {
    throw new UserError(STALE);
  }
  const refund = booking.depositAmount - ownerAmount;
  await systemMessage(
    booking.id,
    `An admin resolved the damage claim: ${formatSEK(ownerAmount)} goes to the owner and ${formatSEK(refund)} of the deposit is refunded to the renter.${note.trim() ? ` Note: "${note.trim().slice(0, 500)}"` : ""}`,
  );
  await settleBooking(booking.id);
}

// ---------------------------------------------------------------------------
// Money settlement and timeouts

/**
 * Performs any payouts/refunds the booking's status calls for. Every call uses
 * an idempotency key and records its Stripe id, so retrying is always safe.
 */
export async function settleBooking(bookingId: string): Promise<void> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { owner: true } });
  if (!booking) return;
  const payments = getPayments();
  const ops = dueMoneyOps(booking);
  try {
    for (const op of ops) await runMoneyOp(booking, op, payments);
    if (booking.settlementError) {
      await db.booking.update({ where: { id: bookingId }, data: { settlementError: null } });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[settlement] booking ${bookingId}:`, message);
    await db.booking.update({ where: { id: bookingId }, data: { settlementError: message.slice(0, 500) } });
  }
}

async function runMoneyOp(
  booking: Prisma.BookingGetPayload<{ include: { owner: true } }>,
  op: MoneyOp,
  payments: ReturnType<typeof getPayments>,
) {
  const key = `booking-${booking.id}-${op.kind}`;
  const paymentIntentId = booking.paymentIntentId!;
  const transferTo = () => {
    if (!booking.owner.stripeAccountId) throw new Error("Owner has no payout account");
    if (!booking.chargeId) throw new Error("Booking has no charge to transfer from");
    return { destination: booking.owner.stripeAccountId, chargeId: booking.chargeId };
  };

  switch (op.kind) {
    case "refund-all": {
      const refundId = await payments.refund({ paymentIntentId, amount: op.amount, idempotencyKey: key });
      await db.booking.update({ where: { id: booking.id }, data: { refundId } });
      break;
    }
    case "payout": {
      const payoutTransferId = await payments.transfer({ bookingId: booking.id, amount: op.amount, idempotencyKey: key, ...transferTo() });
      await db.booking.update({ where: { id: booking.id }, data: { payoutTransferId } });
      break;
    }
    case "claim": {
      const claimTransferId = await payments.transfer({ bookingId: booking.id, amount: op.amount, idempotencyKey: key, ...transferTo() });
      await db.booking.update({ where: { id: booking.id }, data: { claimTransferId } });
      break;
    }
    case "deposit-refund": {
      const depositRefundId = await payments.refund({ paymentIntentId, amount: op.amount, idempotencyKey: key });
      await db.booking.update({ where: { id: booking.id }, data: { depositRefundId } });
      break;
    }
  }
}

/** Applies time-based transitions and retries unfinished settlements. Safe to run often. */
export async function sweepBookings(now: Date = new Date()) {
  const today = todayISO(now);
  const paymentCutoff = new Date(now.getTime() - PAYMENT_WINDOW_HOURS * 3_600_000);

  const unanswered = await db.booking.findMany({
    where: { status: BookingStatus.REQUESTED, startDate: { lt: today } },
    select: { id: true },
  });
  for (const b of unanswered) {
    if (await transition(b.id, BookingStatus.REQUESTED, { status: BookingStatus.EXPIRED })) {
      await systemMessage(b.id, "This request expired because the owner didn't answer before the pickup date.");
    }
  }

  const unpaid = await db.booking.findMany({
    where: {
      status: BookingStatus.ACCEPTED,
      OR: [{ startDate: { lt: today } }, { acceptedAt: { lt: paymentCutoff } }],
    },
    select: { id: true },
  });
  for (const b of unpaid) {
    if (await transition(b.id, BookingStatus.ACCEPTED, { status: BookingStatus.EXPIRED })) {
      await systemMessage(b.id, "This booking expired because it wasn't paid in time. The dates are free again.");
    }
  }

  const notPickedUp = await db.booking.findMany({
    where: { status: BookingStatus.PAID, startDate: { lte: addDays(today, -AUTO_PICKUP_AFTER_DAYS) } },
    select: { id: true },
  });
  for (const b of notPickedUp) {
    if (await transition(b.id, BookingStatus.PAID, { status: BookingStatus.PICKED_UP, pickedUpAt: now })) {
      await systemMessage(b.id, "Pickup was confirmed automatically since the renter didn't cancel. The owner's payout is on its way.");
      await settleBooking(b.id);
    }
  }

  const notReturned = await db.booking.findMany({
    where: { status: BookingStatus.PICKED_UP, endDate: { lte: addDays(today, -DAMAGE_REPORT_DAYS) } },
    select: { id: true, depositAmount: true },
  });
  for (const b of notReturned) {
    if (await transition(b.id, BookingStatus.PICKED_UP, { status: BookingStatus.COMPLETED, completedAt: now })) {
      await systemMessage(
        b.id,
        b.depositAmount > 0
          ? `No damage was reported within ${DAMAGE_REPORT_DAYS} days of the return date, so the deposit has been refunded.`
          : "The rental was completed automatically.",
      );
      await settleBooking(b.id);
    }
  }

  // Retry anything whose money movements didn't finish (Stripe hiccups, crashes).
  const candidates = await db.booking.findMany({
    where: {
      paymentIntentId: { not: null },
      OR: [
        { status: BookingStatus.CANCELLED, refundId: null },
        { status: { in: PICKED_UP_STATUSES }, payoutTransferId: null },
        { status: BookingStatus.COMPLETED, OR: [{ depositRefundId: null }, { claimTransferId: null }] },
      ],
    },
  });
  for (const b of candidates) {
    if (dueMoneyOps(b).length > 0) await settleBooking(b.id);
  }
}

let lastSweep = 0;

/** Runs the sweep at most once a minute per server process. */
export async function maybeSweep() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  try {
    await sweepBookings();
  } catch (e) {
    console.error("[sweep]", e);
  }
}

// ---------------------------------------------------------------------------
// Read helpers for the UI

/** Bookings where the user has an unread message or a step to take. */
export async function bookingsNeedingAttention(userId: string): Promise<Set<string>> {
  const bookings = await db.booking.findMany({
    where: {
      OR: [{ renterId: userId }, { ownerId: userId }],
      status: { notIn: CLOSED_STATUSES.filter((s) => s !== BookingStatus.COMPLETED) },
    },
    select: {
      id: true,
      renterId: true,
      status: true,
      endDate: true,
      renterLastReadAt: true,
      ownerLastReadAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, senderId: true } },
    },
  });
  const today = todayISO();
  const ids = new Set<string>();
  for (const b of bookings) {
    const isRenter = b.renterId === userId;
    const lastRead = isRenter ? b.renterLastReadAt : b.ownerLastReadAt;
    const last = b.messages[0];
    const unread = last && last.senderId !== userId && (!lastRead || last.createdAt > lastRead);
    const actionNeeded = isRenter
      ? b.status === BookingStatus.ACCEPTED
      : b.status === BookingStatus.REQUESTED || (b.status === BookingStatus.PICKED_UP && b.endDate <= today);
    if (unread || actionNeeded) ids.add(b.id);
  }
  return ids;
}
