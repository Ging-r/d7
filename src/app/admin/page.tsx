import type { Metadata } from "next";
import Link from "next/link";
import { resolveClaimAction, retrySettlementAction, runSweepAction } from "@/actions/bookings";
import { ResolveClaimForm } from "@/components/booking/BookingForms";
import { ActionButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { Stat, StatusBadge } from "@/components/ui";
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
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Admin</h1>
        <ActionButton action={runSweepAction} className="btn-secondary" pendingText="Running…">
          Run timeouts & retries now
        </ActionButton>
      </div>

      <dl className="grid grid-cols-2 gap-x-10 gap-y-6 border-t-[3px] border-ink pt-5 sm:grid-cols-4">
        <Stat label="Users" value={users} />
        <Stat label="Active costumes" value={listings} />
        <Stat label="Rental volume" value={formatSEK(revenue._sum.rentalAmount ?? 0)} />
        <Stat label={`Platform revenue${isMockPayments() ? " (demo)" : ""}`} value={formatSEK(revenue._sum.platformFee ?? 0)} />
      </dl>

      <section>
        <h2 className="section-title">Open damage claims ({claims.length})</h2>
        {claims.length === 0 ? (
          <p className="mt-4 border-t-[3px] border-ink pt-4 text-sm text-muted">Nothing to review.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {claims.map((b) => (
              <div key={b.id} className="card flex flex-col gap-3 p-5">
                <div>
                  <Link href={`/bookings/${b.id}`} className="link inline-flex items-center gap-1">
                    {b.listing.title}
                    <Icon name="arrow-right" />
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {formatDateRange(b.startDate, b.endDate)} · owner {b.owner.name} · renter {b.renter.name}
                  </p>
                </div>
                <p className="text-sm">
                  Claims <strong>{formatSEK(b.claimAmount ?? 0)}</strong> of {formatSEK(b.depositAmount)} deposit: &ldquo;{b.claimReason}&rdquo;
                </p>
                <p className="text-xs text-muted">Read the chat on the booking page before deciding.</p>
                <ResolveClaimForm action={resolveClaimAction.bind(null, b.id)} claimAmount={b.claimAmount ?? 0} deposit={b.depositAmount} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Stuck payments ({stuck.length})</h2>
        {stuck.length === 0 ? (
          <p className="mt-4 border-t-[3px] border-ink pt-4 text-sm text-muted">All payouts and refunds have gone through.</p>
        ) : (
          <ul className="mt-4 border-t-[3px] border-ink">
            {stuck.map((b) => (
              <li key={b.id} className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Link href={`/bookings/${b.id}`} className="mr-2 font-semibold decoration-2 underline-offset-2 hover:underline">
                    {b.listing.title}
                  </Link>
                  <StatusBadge status={b.status} />
                  <p className="mt-1.5 text-xs font-medium text-signal">{b.settlementError}</p>
                  <p className="text-xs text-muted">Due: {dueMoneyOps(b).map((op) => `${op.kind} ${formatSEK(op.amount)}`).join(", ")}</p>
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
        <h2 className="section-title">Bookings by status</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-10 border-t-[3px] border-ink text-sm sm:grid-cols-3">
          {byStatus.map((s) => (
            <div key={s.status} className="flex justify-between border-b border-line py-3">
              <dt className="text-ink-soft">{STATUS_LABELS[s.status as BookingStatus] ?? s.status}</dt>
              <dd className="font-semibold tabular-nums">{s._count._all}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
