import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
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
  const { q, theme, ...advanced } = filters;
  const advancedCount = Object.values(advanced).filter(Boolean).length;
  const filtered = Boolean(q || theme || advancedCount);
  const heading = theme ? themeById(theme).label : q ? `“${q}”` : "All costumes";
  const nearestFirst = near && (sort ?? "nearest") === "nearest";

  // Theme links keep every other filter, so picking a theme narrows the current search.
  const themeHref = (id?: string) => {
    const next = new URLSearchParams();
    const entries = { ...filters, theme: id, sort, lat: near?.lat, lng: near?.lng };
    for (const [key, value] of Object.entries(entries)) if (value != null) next.set(key, String(value));
    return next.size > 0 ? `/costumes?${next}` : "/costumes";
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {listings.length} {listings.length === 1 ? "costume" : "costumes"}
            {nearestFirst ? " · nearest first" : ""}
          </p>
          <h1 className="page-title mt-2">{heading}</h1>
        </div>
        <Suspense>
          <NearMeButton />
        </Suspense>
      </div>

      <div className="flex flex-col gap-4">
        <nav aria-label="Themes" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <ThemeLink href={themeHref()} active={!theme}>
            All themes
          </ThemeLink>
          {THEMES.map((t) => (
            <ThemeLink key={t.id} href={themeHref(t.id)} active={theme === t.id}>
              {t.label}
            </ThemeLink>
          ))}
        </nav>

        <form className="group flex flex-col gap-3 border-y border-line py-4">
          {near && (
            <>
              <input type="hidden" name="lat" value={near.lat} />
              <input type="hidden" name="lng" value={near.lng} />
            </>
          )}
          {theme && <input type="hidden" name="theme" value={theme} />}
          <div className="flex gap-2">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted" />
              <input id="q" name="q" defaultValue={q} className="input pl-10" placeholder="Pirate, 70s, cape…" />
            </div>
            {/* On phones the extra filters fold away behind this toggle; from sm up they are always shown. */}
            <label className="btn-secondary relative cursor-pointer px-2.5 has-checked:border-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink sm:hidden">
              <input id="filters-toggle" type="checkbox" className="sr-only" defaultChecked={advancedCount > 0} />
              <Icon name="sliders" className="size-5" />
              <span className="sr-only">Filters</span>
              {advancedCount > 0 && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-tag px-1 text-center text-xs leading-5">
                  {advancedCount}
                </span>
              )}
            </label>
            <button className="btn-primary sm:hidden">Search</button>
          </div>
          <div className="hidden grid-cols-2 gap-3 group-has-[#filters-toggle:checked]:grid sm:grid sm:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
            <div>
              <label htmlFor="size" className="label">
                Size
              </label>
              <select id="size" name="size" defaultValue={filters.size ?? ""} className="input">
                <option value="">Any size</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="maxPrice" className="label">
                Max price (kr)
              </label>
              <input id="maxPrice" name="maxPrice" type="number" min={0} inputMode="numeric" defaultValue={filters.maxPrice} className="input" placeholder="Any" />
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
            <div className="max-sm:col-span-2">
              <label htmlFor="sort" className="label">
                Sort by
              </label>
              <select id="sort" name="sort" defaultValue={sort ?? (near ? "nearest" : "newest")} className="input">
                {SORTS.filter((s) => s.id !== "nearest" || near).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary self-end max-sm:hidden">Search</button>
          </div>
          {(filtered || (filters.from && filters.to)) && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {filters.from && filters.to && <span>Showing costumes that are free for your dates.</span>}
              {filtered && (
                <a href={near ? `/costumes?lat=${near.lat}&lng=${near.lng}` : "/costumes"} className="link text-ink">
                  Clear all filters
                </a>
              )}
            </p>
          )}
        </form>
      </div>

      {listings.length > 0 ? (
        <ListingGrid listings={listings} />
      ) : (
        <EmptyState title="Nothing on the rail" action={{ href: "/costumes", label: "Clear filters" }}>
          No costumes match. Try another theme or size, or different dates.
        </EmptyState>
      )}
    </div>
  );
}

function ThemeLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-soft hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
