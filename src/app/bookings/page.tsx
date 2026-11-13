import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Bookings</h1>
      <nav className="flex gap-1 rounded-full bg-stone-200/70 p-1 text-sm font-semibold sm:self-start">
        <TabLink href="/bookings?tab=renter" active={tab === "renter"} dot={renterAttention}>
          Renting ({renting.length})
        </TabLink>
        <TabLink href="/bookings?tab=owner" active={tab === "owner"} dot={ownerAttention}>
          Renting out ({rentingOut.length})
        </TabLink>
      </nav>

      {shown.length === 0 ? (
        tab === "renter" ? (
          <EmptyState title="No rentals yet" action={{ href: "/costumes", label: "Find a costume" }} />
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

function TabLink({ href, active, dot, children }: { href: string; active: boolean; dot: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`relative flex-1 rounded-full px-4 py-2 text-center ${active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
    >
      {children}
      {dot && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-brand-600" aria-label="needs attention" />}
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
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">{title}</h2>
      <ul className="card divide-y divide-stone-100">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
              <CostumeImage
                filename={b.listing.photos[0]?.filename}
                theme={b.listing.theme}
                alt=""
                className="size-14 shrink-0 rounded-lg text-2xl [&>span]:text-2xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {b.listing.title}
                  {attention.has(b.id) && <span className="ml-2 inline-block size-2 rounded-full bg-brand-600 align-middle" aria-label="needs attention" />}
                </p>
                <p className="text-sm text-stone-500">{formatDateRange(b.startDate, b.endDate)}</p>
                <p className="text-xs text-stone-500">{tab === "owner" ? `Renter: ${b.renter.name}` : `Owner: ${b.owner.name}`}</p>
              </div>
              <StatusBadge status={b.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
