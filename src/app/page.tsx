import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { NearMeButton } from "@/components/NearMeButton";
import { Rail } from "@/components/Rail";
import { EmptyState } from "@/components/ui";
import { APP_NAME, PLATFORM_FEE_PERCENT, THEMES, sizeLabel, themeById } from "@/lib/config";
import { countListingsByTheme, searchListings, type ListingSummary } from "@/lib/listings";
import { formatSEK, quote } from "@/lib/pricing";

const RENTING_STEPS = [
  ["Request your dates", "Find a costume and ask the owner for the days you need. Nothing is charged yet."],
  ["Pay once they accept", "Pay securely in the app. We hold the deposit, and it comes back after the return."],
  ["Meet up and party", "Agree on a spot in the chat, pick the costume up, and hand it back afterwards."],
];

const LENDING_STEPS = [
  "Snap a few photos and set your price and deposit.",
  "Accept the requests that suit you and agree on a meeting spot in the chat.",
  "Get paid when the renter picks the costume up.",
];

export default async function HomePage() {
  const [recent, themeCounts] = await Promise.all([searchListings({ sort: "newest" }, 8), countListingsByTheme()]);
  const total = [...themeCounts.values()].reduce((sum, n) => sum + n, 0);
  // What an owner keeps from a typical rental, for the pitch at the bottom.
  const example = quote({ price: 150, includedDays: 3, extraDayPrice: null, deposit: 0 }, 3, PLATFORM_FEE_PERCENT);

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      <section className="grid items-center gap-12 pt-2 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:pb-4">
        <div>
          <p className="eyebrow">Costume rental between students in Lund</p>
          <h1 className="display mt-4 text-[3.5rem] sm:text-7xl lg:text-[5.75rem]">
            The costume for your next sittning is <span className="bg-tag box-decoration-clone px-[0.12em] sm:whitespace-nowrap">already in Lund.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Rent from other students for a fraction of the price. Or earn back what you paid for the costumes in your own wardrobe.
          </p>
          <form action="/costumes" className="mt-8 flex max-w-xl gap-2">
            <label htmlFor="home-q" className="sr-only">
              Search costumes
            </label>
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
              <input id="home-q" name="q" placeholder="Pirate, 70s, tuxedo…" className="input h-12 pl-11 sm:text-base" />
            </div>
            <button className="btn-primary btn-lg">Search</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Suspense>
              <NearMeButton className="link inline-flex items-center gap-1.5" />
            </Suspense>
            {total > 0 && (
              <span className="text-muted">
                {total} {total === 1 ? "costume" : "costumes"} to rent right now
              </span>
            )}
          </div>
        </div>
        <HeroTag listing={recent[0]} />
      </section>

      {recent.length > 0 ? (
        <Rail
          heading={<h2 className="section-title">Just in</h2>}
          action={
            <Link href="/costumes" className="link text-sm">
              See all {total}
            </Link>
          }
        >
          {recent.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </Rail>
      ) : (
        <EmptyState title="The rail is empty" action={{ href: "/costumes/new", label: "List the first costume" }}>
          Be the first to put a costume on {APP_NAME}.
        </EmptyState>
      )}

      <section>
        <h2 className="section-title">What&apos;s the theme?</h2>
        <ul className="mt-5 grid grid-cols-2 gap-x-6 border-t-[3px] border-ink sm:gap-x-10 lg:grid-cols-3">
          {THEMES.map((t) => (
            <li key={t.id}>
              <Link
                href={`/costumes?theme=${t.id}`}
                className="group flex h-full items-baseline justify-between gap-3 border-b border-line py-3 text-sm font-semibold sm:text-base"
              >
                <span className="decoration-tag-deep decoration-2 underline-offset-4 group-hover:underline">{t.label}</span>
                <span className="font-normal text-muted tabular-nums">{themeCounts.get(t.id) ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="section-title">How renting works</h2>
          <Link href="/how-it-works" className="link text-sm">
            All the details
          </Link>
        </div>
        <ol className="mt-5 grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {RENTING_STEPS.map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[3rem_1fr] border-t-[3px] border-ink pt-4 sm:block">
              <span aria-hidden className="display row-span-2 text-6xl">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold sm:mt-2">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="full-bleed -mb-6 bg-tag py-14 sm:-mb-10 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-20">
          <div>
            <p className="eyebrow text-ink">Rent out your costumes</p>
            <h2 className="display mt-4 text-5xl sm:text-7xl">That costume you wore once? Someone in Lund needs it this weekend.</h2>
          </div>
          <div className="flex flex-col gap-6">
            <ol className="flex flex-col">
              {LENDING_STEPS.map((text, i) => (
                <li key={text} className="flex gap-4 border-t border-ink/25 py-3 first:border-t-[3px] first:border-ink">
                  <span aria-hidden className="display w-5 text-3xl">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm font-medium">{text}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm">
              Listing is free. A {formatSEK(example.rentalAmount)} rental pays you <strong>{formatSEK(example.ownerPayout)}</strong>: we keep{" "}
              {PLATFORM_FEE_PERCENT}% of the rental and never touch the deposit.
            </p>
            <Link href="/costumes/new" className="btn-primary btn-lg self-start">
              Rent out a costume
              <Icon name="arrow-right" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The newest costume, written out on a rental tag that hangs next to the headline. */
function HeroTag({ listing }: { listing?: ListingSummary }) {
  return (
    <div className="relative hidden justify-self-center lg:block">
      <div className="tag-swing drop-shadow-[0_18px_22px_rgb(26_24_20/0.18)] hover:-rotate-1">
        <Link href={listing ? `/costumes/${listing.id}` : "/costumes/new"} className="tag-hanging group block w-80 px-7 pt-16 pb-7">
          <p className="eyebrow text-ink/70">{listing ? "Just in" : "This tag is free"}</p>
          <p className="display mt-2 line-clamp-3 text-[2.75rem]">{listing ? listing.title : "Your costume here"}</p>
          {listing ? (
            <>
              <dl className="mt-5 flex flex-col gap-1.5 border-y border-dashed border-ink/40 py-4 text-sm">
                <TagRow label="Size" value={sizeLabel(listing.size).replace("Size ", "")} />
                <TagRow label="Theme" value={themeById(listing.theme).label} />
                {listing.areaLabel && <TagRow label="Pick up" value={listing.areaLabel} />}
              </dl>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="display text-7xl">{formatSEK(listing.price)}</span>
                <span className="text-sm font-semibold">
                  up to {listing.includedDays} {listing.includedDays === 1 ? "day" : "days"}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-5 border-t border-dashed border-ink/40 pt-4 text-sm">Nothing on the rail yet. Hang up the first costume and set your own price.</p>
          )}
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold decoration-2 underline-offset-4 group-hover:underline">
            {listing ? "See this costume" : "Rent out a costume"}
            <Icon name="arrow-right" />
          </p>
        </Link>
      </div>
      <span aria-hidden className="pointer-events-none absolute bottom-[calc(100%-1.75rem)] left-1/2 h-32 w-0.5 -translate-x-1/2 bg-signal" />
    </div>
  );
}

function TagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      {/* The dotted leader between label and value is drawn by the label. */}
      <dt className="flex flex-1 items-baseline gap-2 text-xs font-semibold tracking-[0.09em] uppercase after:flex-1 after:-translate-y-1 after:border-b after:border-dotted after:border-ink/50">
        {label}
      </dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
