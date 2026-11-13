import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requestBookingAction } from "@/actions/bookings";
import { BookingRequestForm } from "@/components/BookingRequestForm";
import { CostumeMap } from "@/components/map/CostumeMap";
import { Alert, CostumeImage, RatingLine, Stars } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { BLOCKING_STATUSES } from "@/lib/booking-status";
import { MAX_RENTAL_DAYS, themeById } from "@/lib/config";
import { formatMonthYear, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { ratingsFor } from "@/lib/listings";
import { describePricing, formatSEK, maxRentalDays } from "@/lib/pricing";

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
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Gallery photos={listing.photos} theme={listing.theme} title={listing.title} />

        <div>
          <p className="text-sm text-stone-500">
            <Link href={`/costumes?theme=${theme.id}`} className="hover:underline">
              {theme.emoji} {theme.label}
            </Link>{" "}
            · Size {listing.size}
          </p>
          <h1 className="page-title mt-1">{listing.title}</h1>
          <p className="mt-2 text-lg">
            <span className="font-bold">{describePricing(listing)}</span>
          </p>
          {listing.deposit > 0 && <p className="text-sm text-stone-600">+ {formatSEK(listing.deposit)} refundable deposit</p>}
        </div>

        <p className="whitespace-pre-line text-stone-700">{listing.description}</p>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Pickup area{listing.areaLabel ? `: ${listing.areaLabel}` : ""}</h2>
          <p className="mb-3 text-sm text-stone-600">You&apos;ll agree on the exact spot with the owner in the chat. The exact pin is shown once you&apos;ve paid.</p>
          <CostumeMap mode="area" point={{ lat: listing.publicLat, lng: listing.publicLng }} />
        </section>

        <section className="card flex flex-col gap-4 p-4">
          <Link href={`/users/${listing.owner.id}`} className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800">
              {listing.owner.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <span className="block font-semibold hover:underline">{listing.owner.name}</span>
              <span className="block text-xs text-stone-500">Member since {formatMonthYear(listing.owner.createdAt)}</span>
              <RatingLine rating={ratings.get(listing.ownerId)} />
            </span>
          </Link>
          {listing.owner.bio && <p className="text-sm text-stone-600">{listing.owner.bio}</p>}
          {reviews.map((r) => (
            <blockquote key={r.id} className="border-l-2 border-stone-200 pl-3 text-sm">
              <Stars rating={r.rating} /> {r.comment && <span className="text-stone-700">“{r.comment}”</span>}
              <footer className="text-xs text-stone-500">– {r.author.name}</footer>
            </blockquote>
          ))}
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card p-4 sm:p-5">
          {isOwner ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">This is your costume</h2>
              {!listing.active && <Alert tone="warn">It&apos;s hidden, so renters can&apos;t find it.</Alert>}
              <Link href={`/costumes/${listing.id}/edit`} className="btn-primary">
                Edit costume
              </Link>
              <Link href="/bookings?tab=owner" className="btn-secondary">
                See requests
              </Link>
            </div>
          ) : user ? (
            <>
              <h2 className="mb-4 text-lg font-semibold">Pick your dates</h2>
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
            <div className="flex flex-col gap-3 text-center">
              <h2 className="text-lg font-semibold">Want to rent this?</h2>
              <p className="text-sm text-stone-600">Create a free account to request dates and chat with the owner.</p>
              <Link href={`/signup?next=/costumes/${listing.id}`} className="btn-primary py-3">
                Sign up to rent
              </Link>
              <Link href={`/login?next=/costumes/${listing.id}`} className="btn-ghost">
                I already have an account
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Gallery({ photos, theme, title }: { photos: { id: string; filename: string }[]; theme: string; title: string }) {
  if (photos.length === 0) {
    return <CostumeImage theme={theme} alt={title} className="aspect-[4/3] w-full rounded-2xl" />;
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {photos.map((p, i) => (
        <CostumeImage
          key={p.id}
          filename={p.filename}
          theme={theme}
          alt={`${title}, photo ${i + 1}`}
          className={`aspect-[4/5] shrink-0 snap-center rounded-2xl ${photos.length === 1 ? "w-full sm:max-h-[560px]" : "w-[85%] sm:w-[60%]"}`}
        />
      ))}
    </div>
  );
}
