import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/ListingCard";
import { NearMeButton } from "@/components/NearMeButton";
import { EmptyState } from "@/components/ui";
import { APP_NAME, PLATFORM_FEE_PERCENT, THEMES } from "@/lib/config";
import { searchListings } from "@/lib/listings";

export default async function HomePage() {
  const recent = await searchListings({ sort: "newest" }, 8);

  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-fuchsia-500 px-5 py-10 text-white sm:px-10 sm:py-14">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">The costume for your next sittning is already in Lund.</h1>
          <p className="mt-4 text-base text-brand-50 sm:text-lg">
            Rent costumes from other students for a fraction of the price — or earn back what you paid for the ones in your wardrobe.
          </p>
          <form action="/costumes" className="mt-6 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="home-q" className="sr-only">
              Search costumes
            </label>
            <input
              id="home-q"
              name="q"
              placeholder="Pirate, 70s, superhero…"
              className="input flex-1 border-0 py-3 text-base shadow-sm"
            />
            <button className="btn rounded-full bg-amber-400 px-6 py-3 text-base text-stone-900 hover:bg-amber-300">Search</button>
          </form>
          <div className="mt-3">
            <Suspense>
              <NearMeButton className="btn rounded-full bg-white/15 text-white hover:bg-white/25" />
            </Suspense>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-6 -bottom-10 hidden text-[11rem] leading-none opacity-30 sm:block">
          🎭
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Browse by theme</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {THEMES.map((t) => (
            <Link
              key={t.id}
              href={`/costumes?theme=${t.id}`}
              className="shrink-0 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {t.emoji} {t.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Newly listed</h2>
          <Link href="/costumes" className="text-sm font-medium text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        {recent.length > 0 ? (
          <ListingGrid listings={recent} />
        ) : (
          <EmptyState title="No costumes yet" action={{ href: "/costumes/new", label: "List the first one" }}>
            Be the first to put a costume on {APP_NAME}.
          </EmptyState>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-semibold">Renting a costume</h2>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-stone-700">
            <li>1. Find a costume and request your dates.</li>
            <li>2. Once the owner accepts, pay securely in the app. The deposit comes back after the return.</li>
            <li>3. Meet up, pick it up, party, and hand it back.</li>
          </ol>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold">Renting out your costumes</h2>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-stone-700">
            <li>1. Snap a few photos and set your price and deposit.</li>
            <li>2. Accept the requests that suit you and agree on a meeting spot in the chat.</li>
            <li>3. Get paid when the renter picks it up. We keep {PLATFORM_FEE_PERCENT}%.</li>
          </ol>
          <Link href="/costumes/new" className="btn-primary mt-4">
            Rent out a costume
          </Link>
        </div>
      </section>
    </div>
  );
}
