"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import * as bookings from "@/lib/bookings";
import { toActionState, UserError, type ActionState } from "@/lib/errors";
import { isMockPayments } from "@/lib/payments";

export async function requestBookingAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/costumes/${listingId}`);
  let id = "";
  const state = await toActionState(async () => {
    id = await bookings.requestBooking({
      renterId: user.id,
      listingId,
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      message: String(formData.get("message") ?? ""),
    });
  });
  if (state?.error) return state;
  redirect(`/bookings/${id}`);
}

/** Wraps a booking transition: authenticate, run, refresh the booking page. */
async function bookingStep(bookingId: string, step: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await requireUser(`/bookings/${bookingId}`);
  const state = await toActionState(() => step(user.id));
  revalidatePath(`/bookings/${bookingId}`);
  return state;
}

export async function acceptAction(bookingId: string): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.acceptBooking(userId, bookingId));
}

export async function declineAction(bookingId: string): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.declineBooking(userId, bookingId));
}

export async function cancelAction(bookingId: string): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.cancelBooking(userId, bookingId));
}

export async function confirmPickupAction(bookingId: string): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.confirmPickup(userId, bookingId));
}

export async function confirmReturnAction(bookingId: string): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.confirmReturn(userId, bookingId));
}

export async function reportDamageAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return bookingStep(bookingId, (userId) =>
    bookings.reportDamage(userId, bookingId, Number(formData.get("amount")), String(formData.get("reason") ?? "")),
  );
}

/** Marks the chat as read and refreshes the header's unread badge. */
export async function markReadAction(bookingId: string) {
  const user = await requireUser(`/bookings/${bookingId}`);
  await bookings.markRead(user.id, bookingId);
  refresh();
}

export async function sendMessageAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return bookingStep(bookingId, (userId) => bookings.postMessage(userId, bookingId, String(formData.get("body") ?? "")));
}

export async function reviewAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return bookingStep(bookingId, (userId) =>
    bookings.submitReview(userId, bookingId, Number(formData.get("rating")), String(formData.get("comment") ?? "")),
  );
}

export async function payAction(bookingId: string): Promise<ActionState> {
  const user = await requireUser(`/bookings/${bookingId}`);
  let url = "";
  const state = await toActionState(async () => {
    url = await bookings.startCheckout(user.id, bookingId);
  });
  if (state?.error) {
    revalidatePath(`/bookings/${bookingId}`);
    return state;
  }
  redirect(url);
}

/** Demo mode only: stands in for Stripe Checkout completing. */
export async function completeMockPaymentAction(bookingId: string, sessionId: string): Promise<ActionState> {
  const user = await requireUser(`/bookings/${bookingId}`);
  const state = await toActionState(async () => {
    if (!isMockPayments()) throw new UserError("Demo payments are disabled.");
    const { db } = await import("@/lib/db");
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.renterId !== user.id) throw new UserError("Booking not found.");
    if (booking.checkoutSessionId !== sessionId) throw new UserError("This checkout link is out of date. Go back and pay again.");
    await bookings.recordPayment({
      bookingId,
      sessionId,
      paymentIntentId: `mock_pi_${sessionId}`,
      chargeId: `mock_ch_${sessionId}`,
    });
  });
  if (state?.error) return state;
  redirect(`/bookings/${bookingId}`);
}

export async function resolveClaimAction(bookingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const state = await toActionState(() =>
    bookings.resolveClaim(bookingId, Number(formData.get("ownerAmount")), String(formData.get("note") ?? "")),
  );
  revalidatePath("/admin");
  return state;
}

export async function retrySettlementAction(bookingId: string): Promise<ActionState> {
  await requireAdmin();
  await bookings.settleBooking(bookingId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function runSweepAction(): Promise<ActionState> {
  await requireAdmin();
  await bookings.sweepBookings();
  revalidatePath("/admin");
  return { ok: true };
}
