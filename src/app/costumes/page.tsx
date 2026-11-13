import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingGrid } from "@/components/ListingCard";
import { NearMeButton } from "@/components/NearMeButton";
import { EmptyState } from "@/components/ui";
import { SIZES, THEMES, themeById } from "@/lib/config";
import { todayISO } from "@/lib/dates";
import { isValidLatLng } from "@/lib/geo";
import { searchListings, type SortOption } from "@/lib/listings";

export const metadata: Metadata = { title: "Browse costumes" };

const SORTS: { id: SortOption; label: string }[] = [
  { id: "nearest", label: "Nearest" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string) {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const lat = Number(one(params, "lat"));
  const lng = Number(one(params, "lng"));
  const near = one(params, "lat") && one(params, "lng") && isValidLatLng(lat, lng) ? { lat, lng } : undefined;
  const sortParam = one(params, "sort") as SortOption | undefined;
  const sort = SORTS.some((s) => s.id === sortParam) && (sortParam !== "nearest" || near) ? sortParam : undefined;

  const filters = {
    q: one(params, "q"),
    theme: one(params, "theme"),
    size: one(params, "size"),
    maxPrice: Number(one(params, "maxPrice")) || undefined,
    from: one(params, "from"),
    to: one(params, "to"),
  };
  const listings = await searchListings({ ...filters, near, sort });
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const heading = filters.theme ? `${themeById(filters.theme).emoji} ${themeById(filters.theme).label}` : filters.q ? `“${filters.q}”` : "All costumes";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {listings.length} {listings.length === 1 ? "costume" : "costumes"}
            {near ? " · sorted by distance from you" : ""}
          </p>
        </div>
        <Suspense>
          <NearMeButton />
        </Suspense>
      </div>

      <details className="card group p-4" open={activeFilterCount > 0 || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            Filters {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-brand-100 px-2 text-xs text-brand-800">{activeFilterCount}</span>}
          </span>
          <span className="text-stone-400 transition group-open:rotate-180">▾</span>
        </summary>
        <form className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {near && (
            <>
              <input type="hidden" name="lat" value={near.lat} />
              <input type="hidden" name="lng" value={near.lng} />
            </>
          )}
          <div className="col-span-2">
            <label htmlFor="q" className="label">
              Search
            </label>
            <input id="q" name="q" defaultValue={filters.q} className="input" placeholder="Pirate, 70s, cape…" />
          </div>
          <div>
            <label htmlFor="theme" className="label">
              Theme
            </label>
            <select id="theme" name="theme" defaultValue={filters.theme ?? ""} className="input">
              <option value="">Any</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="size" className="label">
              Size
            </label>
            <select id="size" name="size" defaultValue={filters.size ?? ""} className="input">
              <option value="">Any</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="label">
              Pickup
            </label>
            <input id="from" name="from" type="date" min={todayISO()} defaultValue={filters.from} className="input" />
          </div>
          <div>
            <label htmlFor="to" className="label">
              Return
            </label>
            <input id="to" name="to" type="date" min={todayISO()} defaultValue={filters.to} className="input" />
          </div>
          <div>
            <label htmlFor="maxPrice" className="label">
              Max price (kr)
            </label>
            <input id="maxPrice" name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={filters.maxPrice} className="input" />
          </div>
          <div>
            <label htmlFor="sort" className="label">
              Sort
            </label>
            <select id="sort" name="sort" defaultValue={sort ?? (near ? "nearest" : "newest")} className="input">
              {SORTS.filter((s) => s.id !== "nearest" || near).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex gap-2 sm:col-span-4">
            <button className="btn-primary">Apply filters</button>
            <a href={near ? `/costumes?lat=${near.lat}&lng=${near.lng}` : "/costumes"} className="btn-ghost">
              Reset
            </a>
          </div>
          {filters.from && filters.to && <p className="hint col-span-2 sm:col-span-4">Showing costumes free for your dates.</p>}
        </form>
      </details>

      {listings.length > 0 ? (
        <ListingGrid listings={listings} />
      ) : (
        <EmptyState title="No costumes match" action={{ href: "/costumes", label: "Clear filters" }}>
          Try another theme or size, or different dates.
        </EmptyState>
      )}
    </div>
  );
}
