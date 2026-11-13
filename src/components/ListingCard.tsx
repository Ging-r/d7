import Link from "next/link";
import { CostumeImage } from "@/components/ui";
import { themeById } from "@/lib/config";
import { formatDistance } from "@/lib/geo";
import { formatSEK } from "@/lib/pricing";

export interface ListingCardData {
  id: string;
  title: string;
  theme: string;
  size: string;
  price: number;
  includedDays: number;
  areaLabel: string;
  active?: boolean;
  photos: { filename: string }[];
  distanceKm?: number | null;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const theme = themeById(listing.theme);
  return (
    <Link
      href={`/costumes/${listing.id}`}
      className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <CostumeImage
          filename={listing.photos[0]?.filename}
          theme={listing.theme}
          alt={listing.title}
          className="aspect-[4/5] w-full transition group-hover:brightness-105"
        />
        {listing.active === false && (
          <span className="absolute top-2 left-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-xs font-semibold text-white">Hidden</span>
        )}
        <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-stone-800 shadow-sm">
          Size {listing.size}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-1 font-semibold">{listing.title}</p>
        <p className="text-xs text-stone-500">
          {theme.emoji} {theme.label}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5 pt-2">
          <p className="text-sm whitespace-nowrap">
            <span className="font-bold">{formatSEK(listing.price)}</span>
            <span className="text-stone-500"> / {listing.includedDays}d</span>
          </p>
          {(listing.distanceKm != null || listing.areaLabel) && (
            <p className="truncate text-xs text-stone-500">
              📍 {listing.distanceKm != null ? formatDistance(listing.distanceKm) : listing.areaLabel}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
