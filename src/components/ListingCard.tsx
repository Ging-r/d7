import Link from "next/link";
import { CostumeImage, PriceTag } from "@/components/ui";
import { sizeLabel } from "@/lib/config";
import { formatDistance } from "@/lib/geo";

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
  const hidden = listing.active === false;
  const where = listing.distanceKm != null ? `${formatDistance(listing.distanceKm)} away` : listing.areaLabel;
  return (
    <Link href={`/costumes/${listing.id}`} className="group flex flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-lg">
        <CostumeImage
          filename={listing.photos[0]?.filename}
          theme={listing.theme}
          alt={listing.title}
          className={`aspect-[4/5] w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] ${hidden ? "opacity-40 grayscale" : ""}`}
        />
        {hidden && (
          <span className="absolute top-2.5 left-2.5 rounded-sm bg-ink px-2 py-1 text-[11px] leading-none font-semibold tracking-wide text-paper uppercase">
            Hidden
          </span>
        )}
        <PriceTag price={listing.price} days={listing.includedDays} className="absolute bottom-2.5 left-2.5 text-[1.375rem]" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold decoration-2 underline-offset-2 group-hover:underline">{listing.title}</p>
        <p className="truncate text-[13px] text-muted">
          {sizeLabel(listing.size)}
          {where && ` · ${where}`}
        </p>
      </div>
    </Link>
  );
}

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
