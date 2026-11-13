import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CostumeImage, EmptyState, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CLOSED_STATUSES } from "@/lib/booking-status";
import { bookingsNeedingAttention, maybeSweep } from "@/lib/bookings";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("/bookings");
  await maybeSweep();
  const { tab: tabParam } = await searchParams;

  const [bookings, attention] = await Promise.all([
    db.booking.findMany({
      where: { OR: [{ renterId: user.id }, { ownerId: user.id }] },
      orderBy: { createdAt: "desc" },
      include: {
        listing: { select: { title: true, theme: true, photos: { orderBy: { position: "asc" }, take: 1 } } },
        renter: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    bookingsNeedingAttention(user.id),
  ]);

  const renting = bookings.filter((b) => b.renterId === user.id);
  const rentingOut = bookings.filter((b) => b.ownerId === user.id);
  const ownerAttention = rentingOut.some((b) => attention.has(b.id));
  const renterAttention = renting.some((b) => attention.has(b.id));
  const tab = tabParam === "owner" || tabParam === "renter" ? tabParam : ownerAttention && !renterAttention ? "owner" : "renter";
  const shown = tab === "owner" ? rentingOut : renting;
  const active = shown.filter((b) => !(CLOSED_STATUSES as string[]).includes(b.status));
  const past = shown.filter((b) => (CLOSED_STATUSES as string[]).includes(b.status));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="page-title">Bookings</h1>
      <nav aria-label="Bookings" className="flex gap-8 border-b border-line">
        <TabLink href="/bookings?tab=renter" active={tab === "renter"} dot={renterAttention} count={renting.length}>
          Renting
        </TabLink>
        <TabLink href="/bookings?tab=owner" active={tab === "owner"} dot={ownerAttention} count={rentingOut.length}>
          Renting out
        </TabLink>
      </nav>

      {shown.length === 0 ? (
        tab === "renter" ? (
          <EmptyState title="No rentals yet" action={{ href: "/costumes", label: "Find a costume" }}>
            When you request a costume, it shows up here.
          </EmptyState>
        ) : (
          <EmptyState title="No one has rented from you yet" action={{ href: "/costumes/new", label: "Rent out a costume" }}>
            Once you list a costume, requests show up here.
          </EmptyState>
        )
      ) : (
        <>
          {active.length > 0 && <BookingList title="Current" bookings={active} attention={attention} tab={tab} />}
          {past.length > 0 && <BookingList title="Past" bookings={past} attention={attention} tab={tab} />}
        </>
      )}
    </div>
  );
}

function TabLink({ href, active, dot, count, children }: { href: string; active: boolean; dot: boolean; count: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex items-center gap-2 border-b-[3px] pt-1 pb-3 font-semibold ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
      <span className="font-normal text-muted tabular-nums">{count}</span>
      {dot && <span className="size-2 rounded-full bg-signal" aria-label="needs attention" />}
    </Link>
  );
}

type Row = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  listing: { title: string; theme: string; photos: { filename: string }[] };
  renter: { name: string };
  owner: { name: string };
};

function BookingList({ title, bookings, attention, tab }: { title: string; bookings: Row[]; attention: Set<string>; tab: string }) {
  return (
    <section>
      <h2 className="eyebrow mb-3">{title}</h2>
      <ul className="border-t-[3px] border-ink">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link
              href={`/bookings/${b.id}`}
              className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-line py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
            >
              <CostumeImage
                filename={b.listing.photos[0]?.filename}
                theme={b.listing.theme}
                alt=""
                className="row-span-2 size-16 self-start rounded-md sm:row-span-1"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="truncate decoration-2 underline-offset-2 group-hover:underline">{b.listing.title}</span>
                  {attention.has(b.id) && <span className="size-2 shrink-0 rounded-full bg-signal" aria-label="needs attention" />}
                </p>
                <p className="text-sm text-ink-soft">{formatDateRange(b.startDate, b.endDate)}</p>
                <p className="text-[13px] text-muted">{tab === "owner" ? `Renter: ${b.renter.name}` : `Owner: ${b.owner.name}`}</p>
              </div>
              <div className="col-start-2 sm:col-start-3">
                <StatusBadge status={b.status} />
              </div>
              <Icon name="chevron-right" className="hidden size-5 text-muted sm:block" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
