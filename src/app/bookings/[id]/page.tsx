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
import { Icon } from "@/components/Icon";
import { CostumeMap } from "@/components/map/CostumeMap";
import { Alert, BackLink, CostumeImage, ReceiptRow, StatusBadge, Stars } from "@/components/ui";
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
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      {role && hasUnread && <MarkRead action={markReadAction.bind(null, booking.id)} />}
      {role && !(CLOSED_STATUSES as string[]).includes(status) && <AutoRefresh />}

      <div className="flex min-w-0 flex-col gap-8">
        <BackLink href="/bookings">All bookings</BackLink>

        <header className="flex items-start gap-4 sm:gap-6">
          <Link href={`/costumes/${booking.listingId}`} className="shrink-0">
            <CostumeImage
              filename={booking.listing.photos[0]?.filename}
              theme={booking.listing.theme}
              alt={booking.listing.title}
              className="size-20 rounded-md sm:size-28"
            />
          </Link>
          <div className="min-w-0">
            <StatusBadge status={booking.status} />
            <h1 className="display mt-2.5 text-4xl sm:text-5xl">
              <Link href={`/costumes/${booking.listingId}`} className="decoration-2 underline-offset-4 hover:underline">
                {booking.listing.title}
              </Link>
            </h1>
            <p className="mt-2.5 text-sm text-ink-soft">
              {formatDateRange(booking.startDate, booking.endDate)} · {booking.days} {booking.days === 1 ? "day" : "days"}
            </p>
            {role ? (
              <p className="text-sm text-ink-soft">
                {role === "owner" ? "Renter" : "Owner"}:{" "}
                <Link href={`/users/${other.id}`} className="link">
                  {other.name}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-ink-soft">
                Renter {booking.renter.name} · Owner {booking.owner.name}
              </p>
            )}
          </div>
        </header>

        <Progress status={status} />

        {!role && <Alert tone="warn">You&apos;re viewing this booking as an admin.</Alert>}
        {role && settlementDelayed && (
          <Alert tone="warn">A payment step is taking longer than usual. We retry automatically, so there&apos;s no need to do anything.</Alert>
        )}

        {role && <NextStep booking={booking} role={role} />}

        <section>
          <h2 className="section-title">Chat{role ? ` with ${other.name}` : ""}</h2>
          <div className="mt-4 border-t-[3px] border-ink pt-5">
            <ul className="flex flex-col gap-3">
              {booking.messages.map((m) =>
                m.senderId == null ? (
                  // System messages are the booking's timeline, so they read as dividers rather than chat bubbles.
                  <li
                    key={m.id}
                    className="flex items-center gap-3 py-1 text-center text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line"
                  >
                    <span className="max-w-[75%]">
                      {m.body} <time className="whitespace-nowrap">· {formatDateTime(m.createdAt)}</time>
                    </span>
                  </li>
                ) : (
                  <li key={m.id} className={`flex max-w-[85%] flex-col ${m.senderId === user.id ? "items-end self-end" : "items-start self-start"}`}>
                    <div
                      className={`rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-line ${
                        m.senderId === user.id ? "rounded-br-none bg-ink text-paper" : "rounded-bl-none border border-line bg-surface"
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="mt-1 text-[11px] text-muted">
                      {m.senderId === user.id ? "You" : m.sender?.name} · {formatDateTime(m.createdAt)}
                    </span>
                  </li>
                ),
              )}
            </ul>
            {role && (
              <div className="mt-6">
                <MessageForm action={sendMessageAction.bind(null, booking.id)} />
                <p className="mt-2 text-xs text-muted">Keep payments in the app. That&apos;s what protects your money and the deposit.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <section className="card p-5">
          <h2 className="display mb-4 text-2xl">{role === "owner" ? "Your earnings" : "Payment"}</h2>
          <MoneySummary booking={booking} role={role ?? "owner"} />
        </section>
        <section className="card p-5">
          <h2 className="display text-2xl">Meeting point{booking.listing.areaLabel ? `: ${booking.listing.areaLabel}` : ""}</h2>
          {showExactPin ? (
            <>
              <p className="mt-1.5 mb-4 text-sm text-ink-soft">The owner&apos;s pin. Agree on the exact time in the chat.</p>
              <CostumeMap mode="pin" point={{ lat: booking.listing.lat, lng: booking.listing.lng }} className="h-48" />
              <a
                href={`https://www.openstreetmap.org/?mlat=${booking.listing.lat}&mlon=${booking.listing.lng}#map=17/${booking.listing.lat}/${booking.listing.lng}`}
                target="_blank"
                rel="noreferrer"
                className="link mt-3 inline-flex items-center gap-1 text-sm"
              >
                Open in maps
                <Icon name="arrow-up-right" />
              </a>
            </>
          ) : (
            <>
              <p className="mt-1.5 mb-4 text-sm text-ink-soft">Approximate area. The exact spot is shown once the booking is paid.</p>
              <CostumeMap mode="area" point={{ lat: booking.listing.publicLat, lng: booking.listing.publicLng }} className="h-48" />
            </>
          )}
        </section>
      </aside>
    </div>
  );
}

const MILESTONES: { status: BookingStatus; label: string }[] = [
  { status: "REQUESTED", label: "Requested" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "PAID", label: "Paid" },
  { status: "PICKED_UP", label: "Picked up" },
  { status: "COMPLETED", label: "Returned" },
];

/** Where the booking is on its way from request to return. Bookings that ended early don't show it. */
function Progress({ status }: { status: BookingStatus }) {
  const disputed = status === BookingStatus.DISPUTED;
  const reached = MILESTONES.findIndex((m) => m.status === (disputed ? BookingStatus.PICKED_UP : status));
  if (reached < 0) return null;
  return (
    <ol aria-label="Booking progress" className="grid grid-cols-5">
      {MILESTONES.map((m, i) => {
        const done = i <= reached;
        const next = i === reached + 1;
        return (
          <li key={m.status} aria-current={next ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
            {i > 0 && <span aria-hidden className={`absolute top-[9px] right-1/2 -left-1/2 h-0.5 ${done ? "bg-ink" : "bg-line-strong"}`} />}
            <span
              aria-hidden
              className={`relative flex size-5 items-center justify-center rounded-full ${
                done ? "bg-ink text-paper" : next ? (disputed ? "bg-signal" : "bg-tag ring-2 ring-ink ring-inset") : "bg-paper ring-2 ring-line-strong ring-inset"
              }`}
            >
              {done && <Icon name="check" className="size-3 stroke-[3]" />}
            </span>
            <span className={`text-xs ${done || next ? "font-semibold" : "text-muted"} ${next && disputed ? "text-signal" : ""}`}>
              {next && disputed ? "Damage claim" : m.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NextStep({ booking, role }: { booking: FullBooking; role: Role }) {
  const id = booking.id;
  const total = booking.rentalAmount + booking.depositAmount;
  const otherName = role === "owner" ? booking.renter.name : booking.owner.name;
  const cancel = (label: string, confirm: string) => (
    <ActionButton action={cancelAction.bind(null, id)} confirm={confirm} className="btn-ghost text-signal hover:text-signal" pendingText="Cancelling…">
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
        <Step action title={`${otherName} wants to rent your costume`}>
          <p>
            {formatDateRange(booking.startDate, booking.endDate)}. You&apos;d earn <strong>{formatSEK(booking.ownerPayout)}</strong>. Accepting
            declines other requests for overlapping dates.
          </p>
          {!booking.owner.payoutsEnabled && (
            <Alert tone="warn">
              <Link href="/account" className="link">
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
        <Step action title="Accepted! Pay to confirm your booking">
          <p>
            Pay <strong>{formatSEK(total)}</strong>
            {booking.depositAmount > 0 && <> (including a {formatSEK(booking.depositAmount)} refundable deposit)</>} by{" "}
            <strong>{formatDateTime(paymentDeadline(booking.acceptedAt!))}</strong>, or the dates are released.
          </p>
          <Actions>
            <ActionButton action={payAction.bind(null, id)} pendingText="Opening checkout…" className="btn-primary btn-lg">
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
        <Step action title="Booked! Time to meet up">
          <p>
            Pick up the costume from {otherName} on <strong>{formatDate(booking.startDate)}</strong>, and agree on a time in the chat. When you have
            it, tap the button below. That releases the payment to {otherName}.
          </p>
          <p className="text-muted">
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
            Meet {otherName} on <strong>{formatDate(booking.startDate)}</strong>, and agree on a time in the chat. When you hand over the costume,
            ask them to tap <strong>&ldquo;I&apos;ve got the costume&rdquo;</strong> in the app. That sends your {formatSEK(booking.ownerPayout)}.
          </p>
          <Actions>{cancel("Cancel booking", `Cancel? ${otherName} gets a full refund.`)}</Actions>
        </Step>
      );
    case "renter:PICKED_UP":
      return (
        <Step title="Enjoy the party!">
          <p>
            Return the costume to {otherName} by <strong>{formatDate(booking.endDate)}</strong>.
            {booking.depositAmount > 0 && <> Your {formatSEK(booking.depositAmount)} deposit is refunded once they confirm it&apos;s back in good shape.</>}
          </p>
        </Step>
      );
    case "owner:PICKED_UP":
      return (
        <Step action title="Rented out">
          <p>
            Your payout of {formatSEK(booking.ownerPayout)} has been sent. The costume is due back on <strong>{formatDate(booking.endDate)}</strong>.
            When you have it, confirm below to refund the renter&apos;s deposit.
          </p>
          {booking.depositAmount > 0 && (
            <p className="text-muted">
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
          <p className="text-muted">
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
    <Step action={!myReview} title="Rental completed">
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
        <p className="text-muted">
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
    <dl className="flex flex-col gap-1.5 text-sm">
      <ReceiptRow label="Rental" value={formatSEK(booking.rentalAmount)} />
      {role === "owner" ? (
        <>
          <ReceiptRow label={`Platform fee (${feePercent}%)`} value={`−${formatSEK(booking.platformFee)}`} muted />
          <ReceiptRow label="You receive" value={formatSEK(booking.ownerPayout)} total />
          {booking.depositAmount > 0 && <ReceiptRow label="Deposit (held by us)" value={formatSEK(booking.depositAmount)} muted />}
          {booking.claimPaidAmount ? <ReceiptRow label="Damage compensation" value={formatSEK(booking.claimPaidAmount)} /> : null}
          {booking.payoutTransferId && <Settled>Payout sent</Settled>}
        </>
      ) : (
        <>
          {booking.depositAmount > 0 && <ReceiptRow label="Refundable deposit" value={formatSEK(booking.depositAmount)} muted />}
          <ReceiptRow label="Total" value={formatSEK(total)} total />
          {booking.depositRefundId && <Settled>Deposit refunded ({formatSEK(depositBack)})</Settled>}
        </>
      )}
    </dl>
  );
}

function Settled({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ok">
      <Icon name="check" className="size-3.5 stroke-[2.5]" />
      {children}
    </p>
  );
}

/** The "what happens next" panel. `action` marks the steps where it's this user's turn to do something. */
function Step({ title, action, children }: { title: string; action?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-3 rounded-lg p-5 text-sm text-ink-soft sm:p-6 ${action ? "bg-tag-wash" : "border border-line bg-surface"}`}>
      {action && (
        <p className="eyebrow flex items-center gap-2 text-ink">
          <span aria-hidden className="size-2 rounded-full bg-signal" />
          Your move
        </p>
      )}
      <h2 className="display text-3xl text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">{children}</div>;
}
