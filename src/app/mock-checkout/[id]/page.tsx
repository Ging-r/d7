import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeMockPaymentAction } from "@/actions/bookings";
import { ActionButton } from "@/components/forms";
import { Alert, ReceiptRow } from "@/components/ui";
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
      <Alert tone="warn">
        <strong>Demo checkout.</strong> This page stands in for Stripe while the app runs without Stripe keys. No real money moves.
      </Alert>
      <div className="card flex flex-col gap-6 p-6">
        <div>
          <p className="eyebrow">You&apos;re paying for</p>
          <h1 className="display mt-2 text-4xl">{booking.listing.title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{formatDateRange(booking.startDate, booking.endDate)}</p>
        </div>
        <dl className="flex flex-col gap-1.5 text-sm">
          <ReceiptRow label="Rental" value={formatSEK(booking.rentalAmount)} />
          <ReceiptRow label="Refundable deposit" value={formatSEK(booking.depositAmount)} muted />
          <ReceiptRow label="Total" value={formatSEK(booking.rentalAmount + booking.depositAmount)} total />
        </dl>
        <div className="flex flex-col gap-2">
          <ActionButton action={completeMockPaymentAction.bind(null, booking.id, session)} pendingText="Paying…" className="btn-primary btn-lg w-full">
            Pay {formatSEK(booking.rentalAmount + booking.depositAmount)} (simulated)
          </ActionButton>
          <Link href={`/bookings/${booking.id}`} className="btn-ghost">
            Back to booking
          </Link>
        </div>
      </div>
    </div>
  );
}
