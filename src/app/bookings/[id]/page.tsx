import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptAction,
  cancelAction,
  confirmPickupAction,
  confirmReturnAction,
  declineAction,
  markReadAction,
  payAction,
  reportDamageAction,
  reviewAction,
  sendMessageAction,
} from "@/actions/bookings";
import { AutoRefresh, DamageForm, MarkRead, MessageForm, ReviewForm } from "@/components/booking/BookingForms";
import { ActionButton } from "@/components/forms";
import { CostumeMap } from "@/components/map/CostumeMap";
import { Alert, CostumeImage, StatusBadge, Stars } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BookingStatus, CLOSED_STATUSES, dueMoneyOps } from "@/lib/booking-status";
import { maybeSweep, paymentDeadline } from "@/lib/bookings";
import { AUTO_PICKUP_AFTER_DAYS, DAMAGE_REPORT_DAYS } from "@/lib/config";
import { addDays, formatDate, formatDateRange, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatSEK } from "@/lib/pricing";

export const metadata: Metadata = { title: "Booking" };

async function loadBooking(id: string) {
  return db.booking.findUnique({
    where: { id },
    include: {
      listing: { include: { photos: { orderBy: { position: "asc" }, take: 1 } } },
      renter: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, payoutsEnabled: true } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { sender: { select: { name: true } } } },
      reviews: true,
    },
  });
}

type FullBooking = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
type Role = "renter" | "owner";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}`);
  await maybeSweep();
  const booking = await loadBooking(id);
  if (!booking) notFound();
  const role: Role | null = booking.renterId === user.id ? "renter" : booking.ownerId === user.id ? "owner" : null;
  if (!role && !user.isAdmin) notFound();

  const other = role === "owner" ? booking.renter : booking.owner;
  const lastRead = role === "renter" ? booking.renterLastReadAt : booking.ownerLastReadAt;
  const hasUnread = booking.messages.some((m) => m.senderId !== user.id && (!lastRead || m.createdAt > lastRead));
  const status = booking.status as BookingStatus;
  const showExactPin =
    role === "owner" || user.isAdmin || ([BookingStatus.PAID, BookingStatus.PICKED_UP, BookingStatus.DISPUTED] as string[]).includes(status);
  const settlementDelayed = booking.settlementError && dueMoneyOps(booking).length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {role && hasUnread && <MarkRead action={markReadAction.bind(null, booking.id)} />}
      {role && !(CLOSED_STATUSES as string[]).includes(status) && <AutoRefresh />}

      <div className="flex min-w-0 flex-col gap-6">
        <Link href="/bookings" className="text-sm text-stone-500 hover:text-stone-800">
          ← All bookings
        </Link>

        <header className="flex items-start gap-4">
          <Link href={`/costumes/${booking.listingId}`} className="shrink-0">
            <CostumeImage
              filename={booking.listing.photos[0]?.filename}
              theme={booking.listing.theme}
              alt={booking.listing.title}
              className="size-20 rounded-xl sm:size-24"
            />
          </Link>
          <div className="min-w-0">
            <StatusBadge status={booking.status} />
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              <Link href={`/costumes/${booking.listingId}`} className="hover:underline">
                {booking.listing.title}
              </Link>
            </h1>
            <p className="text-sm text-stone-600">
              {formatDateRange(booking.startDate, booking.endDate)} · {booking.days} {booking.days === 1 ? "day" : "days"}
            </p>
            {role ? (
              <p className="text-sm text-stone-600">
                {role === "owner" ? "Renter" : "Owner"}:{" "}
                <Link href={`/users/${other.id}`} className="font-medium text-brand-700 hover:underline">
                  {other.name}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-stone-600">
                Renter {booking.renter.name} · Owner {booking.owner.name}
              </p>
            )}
          </div>
        </header>

        {!role && <Alert tone="warn">You&apos;re viewing this booking as an admin.</Alert>}
        {role && settlementDelayed && (
          <Alert tone="warn">A payment step is taking longer than usual. We retry automatically — no need to do anything.</Alert>
        )}

        {role && (
          <section className="card flex flex-col gap-4 p-4 sm:p-5">
            <NextStep booking={booking} role={role} />
          </section>
        )}

        <section className="card flex flex-col p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Chat{role ? ` with ${other.name}` : ""}</h2>
          <ul className="flex flex-col gap-3">
            {booking.messages.map((m) =>
              m.senderId == null ? (
                <li key={m.id} className="mx-auto max-w-md rounded-xl bg-stone-100 px-3 py-2 text-center text-xs text-stone-600">
                  {m.body}
                  <time className="mt-0.5 block text-[10px] text-stone-400">{formatDateTime(m.createdAt)}</time>
                </li>
              ) : (
                <li key={m.id} className={`flex max-w-[85%] flex-col ${m.senderId === user.id ? "self-end items-end" : "self-start items-start"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                      m.senderId === user.id ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-stone-100 text-stone-900"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="mt-0.5 text-[10px] text-stone-400">
                    {m.senderId === user.id ? "You" : m.sender?.name} · {formatDateTime(m.createdAt)}
                  </span>
                </li>
              ),
            )}
          </ul>
          {role && (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <MessageForm action={sendMessageAction.bind(null, booking.id)} />
              <p className="mt-2 text-xs text-stone-500">Keep payments in the app — that&apos;s what protects your money and the deposit.</p>
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{role === "owner" ? "Your earnings" : "Payment"}</h2>
          <MoneySummary booking={booking} role={role ?? "owner"} />
        </section>
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Meeting point{booking.listing.areaLabel ? `: ${booking.listing.areaLabel}` : ""}</h2>
          {showExactPin ? (
            <>
              <p className="mb-3 text-sm text-stone-600">The owner&apos;s pin. Agree on the exact time in the chat.</p>
              <CostumeMap mode="pin" point={{ lat: booking.listing.lat, lng: booking.listing.lng }} className="h-48" />
              <a
                href={`https://www.openstreetmap.org/?mlat=${booking.listing.lat}&mlon=${booking.listing.lng}#map=17/${booking.listing.lat}/${booking.listing.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Open in maps ↗
              </a>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-stone-600">Approximate area. The exact spot is shown once the booking is paid.</p>
              <CostumeMap mode="area" point={{ lat: booking.listing.publicLat, lng: booking.listing.publicLng }} className="h-48" />
            </>
          )}
        </section>
      </aside>
    </div>
  );
}

function NextStep({ booking, role }: { booking: FullBooking; role: Role }) {
  const id = booking.id;
  const total = booking.rentalAmount + booking.depositAmount;
  const otherName = role === "owner" ? booking.renter.name : booking.owner.name;
  const cancel = (label: string, confirm: string) => (
    <ActionButton action={cancelAction.bind(null, id)} confirm={confirm} className="btn-ghost text-red-700" pendingText="Cancelling…">
      {label}
    </ActionButton>
  );

  switch (`${role}:${booking.status}`) {
    case "renter:REQUESTED":
      return (
        <Step title={`Waiting for ${otherName} to respond`}>
          <p>You&apos;ll be able to pay once they accept. Requests expire if they aren&apos;t answered before the pickup date.</p>
          <Actions>{cancel("Withdraw request", "Withdraw your request?")}</Actions>
        </Step>
      );
    case "owner:REQUESTED":
      return (
        <Step title={`${otherName} wants to rent your costume`}>
          <p>
            {formatDateRange(booking.startDate, booking.endDate)}. You&apos;d earn <strong>{formatSEK(booking.ownerPayout)}</strong>. Accepting
            declines other requests for overlapping dates.
          </p>
          {!booking.owner.payoutsEnabled && (
            <Alert tone="warn">
              <Link href="/account" className="font-semibold underline">
                Set up payouts
              </Link>{" "}
              before accepting so you can get paid.
            </Alert>
          )}
          <Actions>
            <ActionButton action={acceptAction.bind(null, id)} pendingText="Accepting…">
              Accept request
            </ActionButton>
            <ActionButton action={declineAction.bind(null, id)} confirm="Decline this request?" className="btn-secondary" pendingText="Declining…">
              Decline
            </ActionButton>
          </Actions>
        </Step>
      );
    case "renter:ACCEPTED":
      return (
        <Step title="Accepted! Pay to confirm your booking">
          <p>
            Pay <strong>{formatSEK(total)}</strong>
            {booking.depositAmount > 0 && <> (including a {formatSEK(booking.depositAmount)} refundable deposit)</>} by{" "}
            <strong>{formatDateTime(paymentDeadline(booking.acceptedAt!))}</strong>, or the dates are released.
          </p>
          <Actions>
            <ActionButton action={payAction.bind(null, id)} pendingText="Opening checkout…" className="btn-primary px-6 py-3">
              Pay {formatSEK(total)}
            </ActionButton>
            {cancel("Cancel", "Cancel this booking?")}
          </Actions>
        </Step>
      );
    case "owner:ACCEPTED":
      return (
        <Step title={`Waiting for ${otherName} to pay`}>
          <p>They have until {formatDateTime(paymentDeadline(booking.acceptedAt!))}. The dates are held for them until then.</p>
          <Actions>{cancel("Cancel booking", "Cancel this booking? The renter will be notified.")}</Actions>
        </Step>
      );
    case "renter:PAID":
      return (
        <Step title="Booked! Time to meet up">
          <p>
            Pick up the costume from {otherName} on <strong>{formatDate(booking.startDate)}</strong> — agree on a time in the chat. When you have
            it, tap the button below. That releases the payment to {otherName}.
          </p>
          <p className="text-stone-500">
            Something went wrong? Cancel for a full refund. If you neither confirm nor cancel by the end of{" "}
            {formatDate(addDays(booking.startDate, AUTO_PICKUP_AFTER_DAYS - 1))}, pickup is confirmed automatically.
          </p>
          <Actions>
            <ActionButton action={confirmPickupAction.bind(null, id)} confirm="Confirm that you have the costume?" pendingText="Confirming…">
              I&apos;ve got the costume
            </ActionButton>
            {cancel("Cancel and get a refund", `Cancel the booking? You'll get the full ${formatSEK(total)} back.`)}
          </Actions>
        </Step>
      );
    case "owner:PAID":
      return (
        <Step title="Paid! Time to hand it over">
          <p>
            Meet {otherName} on <strong>{formatDate(booking.startDate)}</strong> — agree on a time in the chat. When you hand over the costume, ask
            them to tap <em>&ldquo;I&apos;ve got the costume&rdquo;</em> in the app. That sends your {formatSEK(booking.ownerPayout)}.
          </p>
          <Actions>{cancel("Cancel booking", `Cancel? ${otherName} gets a full refund.`)}</Actions>
        </Step>
      );
    case "renter:PICKED_UP":
      return (
        <Step title="Enjoy the party! 🎉">
          <p>
            Return the costume to {otherName} by <strong>{formatDate(booking.endDate)}</strong>.
            {booking.depositAmount > 0 && <> Your {formatSEK(booking.depositAmount)} deposit is refunded once they confirm it&apos;s back in good shape.</>}
          </p>
        </Step>
      );
    case "owner:PICKED_UP":
      return (
        <Step title="Rented out">
          <p>
            Your payout of {formatSEK(booking.ownerPayout)} has been sent. The costume is due back on <strong>{formatDate(booking.endDate)}</strong>.
            When you have it, confirm below to refund the renter&apos;s deposit.
          </p>
          {booking.depositAmount > 0 && (
            <p className="text-stone-500">
              Damaged? Report it by the end of {formatDate(addDays(booking.endDate, DAMAGE_REPORT_DAYS - 1))}. After that the deposit is refunded
              automatically.
            </p>
          )}
          <Actions>
            <ActionButton action={confirmReturnAction.bind(null, id)} confirm="Confirm the costume came back in good condition?" pendingText="Confirming…">
              Returned in good condition
            </ActionButton>
            {booking.depositAmount > 0 && <DamageForm action={reportDamageAction.bind(null, id)} deposit={booking.depositAmount} />}
          </Actions>
        </Step>
      );
    case "renter:DISPUTED":
    case "owner:DISPUTED":
      return (
        <Step title="Damage claim under review">
          <p>
            {role === "owner" ? "You claimed" : `${otherName} claimed`} <strong>{formatSEK(booking.claimAmount ?? 0)}</strong> of the deposit:
            &ldquo;{booking.claimReason}&rdquo;
          </p>
          <p className="text-stone-500">
            An admin will read the chat and decide how to split the deposit. {role === "renter" && "Add your side of the story below."}
          </p>
        </Step>
      );
    case "renter:COMPLETED":
    case "owner:COMPLETED":
      return <Completed booking={booking} role={role} />;
    case "renter:DECLINED":
    case "owner:DECLINED":
      return (
        <Step title="Request declined">
          {role === "renter" && (
            <Link href="/costumes" className="btn-secondary self-start">
              Find another costume
            </Link>
          )}
        </Step>
      );
    case "renter:EXPIRED":
    case "owner:EXPIRED":
      return <Step title="This booking expired">{role === "renter" && <p>No money was taken.</p>}</Step>;
    case "renter:CANCELLED":
    case "owner:CANCELLED":
      return (
        <Step title="Booking cancelled">
          {booking.paymentIntentId && (
            <p>
              {booking.refundId ? "Refunded" : "Refunding"} {formatSEK(total)} to {role === "renter" ? "you" : otherName}. Refunds usually show up within
              5–10 days.
            </p>
          )}
        </Step>
      );
    default:
      return null;
  }
}

function Completed({ booking, role }: { booking: FullBooking; role: Role }) {
  const myReview = booking.reviews.find((r) => r.authorId === (role === "renter" ? booking.renterId : booking.ownerId));
  const theirReview = booking.reviews.find((r) => r !== myReview);
  const otherName = role === "owner" ? booking.renter.name : booking.owner.name;
  return (
    <Step title="Rental completed">
      {booking.claimPaidAmount != null && (
        <p>
          The damage claim was resolved: {formatSEK(booking.claimPaidAmount)} went to the owner
          {booking.resolutionNote && <> (&ldquo;{booking.resolutionNote}&rdquo;)</>}.
        </p>
      )}
      {myReview ? (
        <p>
          You rated {otherName} <Stars rating={myReview.rating} />
        </p>
      ) : (
        <ReviewForm action={reviewAction.bind(null, booking.id)} subjectName={otherName} />
      )}
      {theirReview && (
        <p className="text-stone-500">
          {otherName} rated you <Stars rating={theirReview.rating} />
          {theirReview.comment && <> – &ldquo;{theirReview.comment}&rdquo;</>}
        </p>
      )}
    </Step>
  );
}

function MoneySummary({ booking, role }: { booking: FullBooking; role: Role }) {
  const total = booking.rentalAmount + booking.depositAmount;
  const depositBack = booking.depositAmount - (booking.claimPaidAmount ?? 0);
  const feePercent = booking.rentalAmount > 0 ? Math.round((booking.platformFee / booking.rentalAmount) * 100) : 0;
  return (
    <dl className="flex flex-col gap-1 text-sm">
      <Row label="Rental" value={formatSEK(booking.rentalAmount)} />
      {role === "owner" ? (
        <>
          <Row label={`Platform fee (${feePercent}%)`} value={`−${formatSEK(booking.platformFee)}`} muted />
          <Row label="You receive" value={formatSEK(booking.ownerPayout)} strong />
          {booking.depositAmount > 0 && <Row label="Deposit (held by us)" value={formatSEK(booking.depositAmount)} muted />}
          {booking.claimPaidAmount ? <Row label="Damage compensation" value={formatSEK(booking.claimPaidAmount)} /> : null}
          {booking.payoutTransferId && <p className="mt-2 text-xs text-emerald-700">✓ Payout sent</p>}
        </>
      ) : (
        <>
          {booking.depositAmount > 0 && <Row label="Refundable deposit" value={formatSEK(booking.depositAmount)} muted />}
          <Row label="Total" value={formatSEK(total)} strong />
          {booking.depositRefundId && <p className="mt-2 text-xs text-emerald-700">✓ Deposit refunded ({formatSEK(depositBack)})</p>}
        </>
      )}
    </dl>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-stone-500" : ""} ${strong ? "mt-1 border-t border-stone-100 pt-1 font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Step({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-700">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">{children}</div>;
}
