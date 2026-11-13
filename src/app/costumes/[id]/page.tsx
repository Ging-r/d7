import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requestBookingAction } from "@/actions/bookings";
import { BookingRequestForm } from "@/components/BookingRequestForm";
import { CostumeMap } from "@/components/map/CostumeMap";
import { Alert, Avatar, CostumeImage, PriceTag, RatingLine, Stars } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { BLOCKING_STATUSES } from "@/lib/booking-status";
import { MAX_RENTAL_DAYS, themeById } from "@/lib/config";
import { formatMonthYear, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { ratingsFor } from "@/lib/listings";
import { formatSEK, maxRentalDays } from "@/lib/pricing";

type Props = { params: Promise<{ id: string }> };

async function loadListing(id: string) {
  return db.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      owner: { select: { id: true, name: true, bio: true, createdAt: true } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  return { title: listing?.title ?? "Costume not found" };
}

export default async function CostumePage({ params }: Props) {
  const { id } = await params;
  const [listing, user] = await Promise.all([loadListing(id), getCurrentUser()]);
  if (!listing) notFound();
  const isOwner = user?.id === listing.ownerId;
  if (!listing.active && !isOwner) notFound();

  const today = todayISO();
  const [blocked, ratings, reviews] = await Promise.all([
    db.booking.findMany({
      where: { listingId: listing.id, status: { in: BLOCKING_STATUSES }, endDate: { gt: today } },
      orderBy: { startDate: "asc" },
      select: { startDate: true, endDate: true },
    }),
    ratingsFor([listing.ownerId]),
    db.review.findMany({
      where: { subjectId: listing.ownerId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { author: { select: { name: true } } },
    }),
  ]);
  const theme = themeById(listing.theme);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link href="/costumes" className="hover:text-ink">
          Costumes
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/costumes?theme=${theme.id}`} className="hover:text-ink">
          {theme.label}
        </Link>
      </nav>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-10">
          <Gallery photos={listing.photos} theme={listing.theme} title={listing.title} />

          <div>
            <h1 className="page-title">{listing.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <PriceTag price={listing.price} days={listing.includedDays} className="text-3xl" />
              {listing.extraDayPrice != null && <span className="text-sm text-ink-soft">then {formatSEK(listing.extraDayPrice)} per extra day</span>}
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 border-t-[3px] border-ink sm:grid-cols-4">
              <Spec label="Size" value={listing.size} />
              <Spec label="Theme" value={theme.label} />
              <Spec label="Pick up" value={listing.areaLabel || "Lund"} />
              <Spec label="Deposit" value={listing.deposit > 0 ? formatSEK(listing.deposit) : "None"} hint={listing.deposit > 0 ? "Refunded after return" : undefined} />
            </dl>
            <p className="mt-6 max-w-prose text-[17px] leading-relaxed whitespace-pre-line text-ink-soft">{listing.description}</p>
          </div>

          <section>
            <h2 className="section-title">Rented out by</h2>
            <div className="mt-4 flex flex-col gap-4 border-t-[3px] border-ink pt-5">
              <Link href={`/users/${listing.owner.id}`} className="group flex items-center gap-4 self-start">
                <Avatar name={listing.owner.name} />
                <span>
                  <span className="block text-lg leading-tight font-semibold decoration-2 underline-offset-2 group-hover:underline">{listing.owner.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                    <RatingLine rating={ratings.get(listing.ownerId)} />
                    <span>Member since {formatMonthYear(listing.owner.createdAt)}</span>
                  </span>
                </span>
              </Link>
              {listing.owner.bio && <p className="max-w-prose text-ink-soft">{listing.owner.bio}</p>}
              {reviews.length > 0 && (
                <ul className="flex flex-col gap-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="border-l-[3px] border-tag pl-4 text-sm">
                      <Stars rating={r.rating} />
                      {r.comment && <p className="mt-1 text-ink">“{r.comment}”</p>}
                      <p className="mt-1 text-xs text-muted">{r.author.name}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="section-title">Where to pick it up</h2>
            <div className="mt-4 border-t-[3px] border-ink pt-5">
              <p className="mb-4 max-w-prose text-sm text-ink-soft">
                {listing.areaLabel ? `Around ${listing.areaLabel}. ` : ""}
                You&apos;ll agree on the exact spot with {listing.owner.name} in the chat, and see the exact pin once you&apos;ve paid.
              </p>
              <CostumeMap mode="area" point={{ lat: listing.publicLat, lng: listing.publicLng }} />
            </div>
          </section>
        </div>

        <aside id="rent" className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5 sm:p-6">
            {isOwner ? (
              <div className="flex flex-col gap-3">
                <h2 className="display text-3xl">This is your costume</h2>
                {!listing.active && <Alert tone="warn">It&apos;s hidden, so renters can&apos;t find it.</Alert>}
                <Link href={`/costumes/${listing.id}/edit`} className="btn-primary btn-lg mt-1">
                  Edit costume
                </Link>
                <Link href="/bookings?tab=owner" className="btn-secondary btn-lg">
                  See requests
                </Link>
              </div>
            ) : user ? (
              <>
                <h2 className="display mb-5 text-3xl">Pick your dates</h2>
                <BookingRequestForm
                  action={requestBookingAction.bind(null, listing.id)}
                  // Only pricing fields: the full row includes the private exact location.
                  listing={{
                    price: listing.price,
                    includedDays: listing.includedDays,
                    extraDayPrice: listing.extraDayPrice,
                    deposit: listing.deposit,
                  }}
                  maxDays={maxRentalDays(listing, MAX_RENTAL_DAYS)}
                  blocked={blocked}
                  today={today}
                />
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="display text-3xl">Want to rent this?</h2>
                <p className="text-sm text-ink-soft">Create a free account to request dates and chat with {listing.owner.name}. You pay nothing until they accept.</p>
                <Link href={`/signup?next=/costumes/${listing.id}`} className="btn-primary btn-lg mt-1">
                  Sign up to rent
                </Link>
                <Link href={`/login?next=/costumes/${listing.id}`} className="btn-secondary btn-lg">
                  I already have an account
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* On phones the dates form sits below everything else, so keep the price and a way down to it in view. */}
      {!isOwner && (
        <div className="sticky bottom-0 -mx-4 -mb-6 flex items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3 sm:-mb-10 lg:hidden">
          <PriceTag price={listing.price} days={listing.includedDays} className="text-2xl" />
          <a href="#rent" className="btn-primary">
            {user ? "Pick your dates" : "Rent this costume"}
          </a>
        </div>
      )}
    </div>
  );
}

function Spec({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-b border-line py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-semibold">
        {value}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </dd>
    </div>
  );
}

function Gallery({ photos, theme, title }: { photos: { id: string; filename: string }[]; theme: string; title: string }) {
  if (photos.length === 0) {
    return <CostumeImage theme={theme} alt={title} className="aspect-[4/3] w-full rounded-lg" />;
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {photos.map((p, i) => (
        <CostumeImage
          key={p.id}
          filename={p.filename}
          theme={theme}
          alt={`${title}, photo ${i + 1}`}
          className={`aspect-[4/5] shrink-0 snap-center rounded-lg ${photos.length === 1 ? "w-full sm:max-h-[560px]" : "w-[85%] sm:w-[60%]"}`}
        />
      ))}
    </div>
  );
}
