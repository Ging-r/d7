import type { Metadata } from "next";
import Link from "next/link";
import { resolveClaimAction, retrySettlementAction, runSweepAction } from "@/actions/bookings";
import { ResolveClaimForm } from "@/components/booking/BookingForms";
import { ActionButton } from "@/components/forms";
import { StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { BookingStatus, STATUS_LABELS, dueMoneyOps } from "@/lib/booking-status";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { isMockPayments } from "@/lib/payments";
import { formatSEK } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [claims, failing, byStatus, revenue, users, listings] = await Promise.all([
    db.booking.findMany({
      where: { status: BookingStatus.DISPUTED },
      orderBy: { updatedAt: "asc" },
      include: { listing: { select: { title: true } }, renter: { select: { name: true } }, owner: { select: { name: true } } },
    }),
    db.booking.findMany({ where: { settlementError: { not: null } }, include: { listing: { select: { title: true } } } }),
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.booking.aggregate({ where: { payoutTransferId: { not: null } }, _sum: { platformFee: true, rentalAmount: true } }),
    db.user.count(),
    db.listing.count({ where: { active: true } }),
  ]);
  const stuck = failing.filter((b) => dueMoneyOps(b).length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Admin</h1>
        <ActionButton action={runSweepAction} className="btn-secondary" pendingText="Running…">
          Run timeouts & retries now
        </ActionButton>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Users" value={users} />
        <Stat label="Active costumes" value={listings} />
        <Stat label="Rental volume" value={formatSEK(revenue._sum.rentalAmount ?? 0)} />
        <Stat label={`Platform revenue${isMockPayments() ? " (demo)" : ""}`} value={formatSEK(revenue._sum.platformFee ?? 0)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open damage claims ({claims.length})</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing to review.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {claims.map((b) => (
              <div key={b.id} className="card flex flex-col gap-3 p-4">
                <div>
                  <Link href={`/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">
                    {b.listing.title} →
                  </Link>
                  <p className="text-sm text-stone-500">
                    {formatDateRange(b.startDate, b.endDate)} · owner {b.owner.name} · renter {b.renter.name}
                  </p>
                </div>
                <p className="text-sm">
                  Claims <strong>{formatSEK(b.claimAmount ?? 0)}</strong> of {formatSEK(b.depositAmount)} deposit: &ldquo;{b.claimReason}&rdquo;
                </p>
                <p className="text-xs text-stone-500">Read the chat on the booking page before deciding.</p>
                <ResolveClaimForm action={resolveClaimAction.bind(null, b.id)} claimAmount={b.claimAmount ?? 0} deposit={b.depositAmount} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Stuck payments ({stuck.length})</h2>
        {stuck.length === 0 ? (
          <p className="text-sm text-stone-500">All payouts and refunds have gone through.</p>
        ) : (
          <ul className="card divide-y divide-stone-100">
            {stuck.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">
                    {b.listing.title}
                  </Link>{" "}
                  <StatusBadge status={b.status} />
                  <p className="text-xs text-red-700">{b.settlementError}</p>
                  <p className="text-xs text-stone-500">Due: {dueMoneyOps(b).map((op) => `${op.kind} ${formatSEK(op.amount)}`).join(", ")}</p>
                </div>
                <ActionButton action={retrySettlementAction.bind(null, b.id)} className="btn-secondary" pendingText="Retrying…">
                  Retry
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bookings by status</h2>
        <dl className="card grid grid-cols-2 gap-x-6 gap-y-1 p-4 text-sm sm:grid-cols-3">
          {byStatus.map((s) => (
            <div key={s.status} className="flex justify-between">
              <dt className="text-stone-600">{STATUS_LABELS[s.status as BookingStatus] ?? s.status}</dt>
              <dd className="font-semibold">{s._count._all}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
