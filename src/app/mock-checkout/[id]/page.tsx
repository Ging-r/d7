import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeMockPaymentAction } from "@/actions/bookings";
import { ActionButton } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { isMockPayments } from "@/lib/payments";
import { formatSEK } from "@/lib/pricing";

export const metadata: Metadata = { title: "Demo checkout" };

/** Stands in for Stripe Checkout when no Stripe keys are configured. */
export default async function MockCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  if (!isMockPayments()) notFound();
  const { id } = await params;
  const { session } = await searchParams;
  const user = await requireUser(`/bookings/${id}`);
  const booking = await db.booking.findUnique({ where: { id }, include: { listing: { select: { title: true } } } });
  if (!booking || booking.renterId !== user.id || !session) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
        <strong>Demo checkout.</strong> This page stands in for Stripe while the app runs without Stripe keys. No real money moves.
      </div>
      <div className="card flex flex-col gap-4 p-6">
        <h1 className="text-xl font-bold">{booking.listing.title}</h1>
        <p className="text-sm text-stone-600">{formatDateRange(booking.startDate, booking.endDate)}</p>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Rental</dt>
            <dd>{formatSEK(booking.rentalAmount)}</dd>
          </div>
          <div className="flex justify-between text-stone-500">
            <dt>Refundable deposit</dt>
            <dd>{formatSEK(booking.depositAmount)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-stone-100 pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatSEK(booking.rentalAmount + booking.depositAmount)}</dd>
          </div>
        </dl>
        <ActionButton action={completeMockPaymentAction.bind(null, booking.id, session)} pendingText="Paying…" className="btn-primary py-3">
          Pay {formatSEK(booking.rentalAmount + booking.depositAmount)} (simulated)
        </ActionButton>
        <Link href={`/bookings/${booking.id}`} className="btn-ghost">
          Back to booking
        </Link>
      </div>
    </div>
  );
}
