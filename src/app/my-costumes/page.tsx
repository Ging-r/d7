import type { Metadata } from "next";
import Link from "next/link";
import { setListingActiveAction } from "@/actions/listings";
import { ActionButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { Alert, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "My costumes" };

export default async function MyCostumesPage() {
  const user = await requireUser("/my-costumes");
  const listings = await db.listing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      photos: { orderBy: { position: "asc" }, take: 1 },
      _count: { select: { bookings: { where: { status: "REQUESTED" } } } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">My costumes</h1>
        <Link href="/costumes/new" className="btn-primary">
          <Icon name="plus" />
          Add costume
        </Link>
      </div>
      {!user.payoutsEnabled && listings.length > 0 && (
        <Alert tone="warn">
          <Link href="/account" className="link">
            Set up payouts
          </Link>{" "}
          so you can accept requests and get paid.
        </Alert>
      )}
      {listings.length === 0 ? (
        <EmptyState title="Your rail is empty" action={{ href: "/costumes/new", label: "Rent out a costume" }}>
          That costume you wore once? Someone in Lund needs it this weekend.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col gap-3">
              <ListingCard listing={l} />
              {l._count.bookings > 0 && (
                <Link href="/bookings?tab=owner" className="inline-flex items-center gap-2 self-start text-sm font-semibold underline-offset-2 hover:underline">
                  <span aria-hidden className="size-2 rounded-full bg-signal" />
                  {l._count.bookings} new {l._count.bookings === 1 ? "request" : "requests"}
                </Link>
              )}
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Link href={`/costumes/${l.id}/edit`} className="btn-secondary min-h-9 px-2 text-[13px]">
                  Edit
                </Link>
                <ActionButton action={setListingActiveAction.bind(null, l.id, !l.active)} className="btn-secondary min-h-9 w-full px-2 text-[13px]">
                  {l.active ? "Hide" : "Show"}
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
