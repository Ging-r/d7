import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { BLOCKING_STATUSES } from "./booking-status";
import { MAX_PHOTOS, SIZES, THEME_IDS } from "./config";
import { isISODate } from "./dates";
import { db } from "./db";
import { UserError } from "./errors";
import { distanceKm, fuzzLocation, type LatLng } from "./geo";
import { deleteImage, saveImage } from "./uploads";

const requiredNumber = (message: string) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: message }));
const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int("Use whole kronor.").nullable(),
);

const listingSchema = z.object({
  title: z.string().trim().min(3, "Give the costume a title (at least 3 characters).").max(80, "Keep the title under 80 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Describe the costume in a sentence or two.")
    .max(3000, "Keep the description under 3000 characters."),
  theme: z.enum(THEME_IDS, { error: "Pick a theme." }),
  size: z.enum(SIZES, { error: "Pick a size." }),
  price: requiredNumber("Set a price.").pipe(
    z.number().int("Use whole kronor.").min(10, "The price must be at least 10 kr.").max(10_000, "That price is too high."),
  ),
  includedDays: requiredNumber("Set how many days the price covers.").pipe(
    z.number().int().min(1, "The price must cover at least 1 day.").max(14, "The price can cover at most 14 days."),
  ),
  extraDayPrice: optionalNumber.pipe(z.number().min(0).max(5_000, "That extra-day price is too high.").nullable()),
  deposit: requiredNumber("Set a deposit (0 for none).").pipe(
    z.number().int("Use whole kronor.").min(0, "The deposit can't be negative.").max(20_000, "The deposit can be at most 20 000 kr."),
  ),
  value: optionalNumber.pipe(z.number().min(0).max(1_000_000).nullable()),
  areaLabel: z.string().trim().max(60, "Keep the area name under 60 characters.").default(""),
  lat: requiredNumber("Drop a pin on the map where you'd like to meet.").pipe(z.number().min(-90).max(90)),
  lng: requiredNumber("Drop a pin on the map where you'd like to meet.").pipe(z.number().min(-180).max(180)),
});

export type ListingInput = z.infer<typeof listingSchema>;

function parseListingForm(formData: FormData): ListingInput {
  const raw = Object.fromEntries(
    ["title", "description", "theme", "size", "price", "includedDays", "extraDayPrice", "deposit", "value", "areaLabel", "lat", "lng"].map(
      (k) => [k, formData.get(k) ?? undefined],
    ),
  );
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  return parsed.data;
}

function newPhotos(formData: FormData): File[] {
  return formData.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
}

export async function createListing(ownerId: string, formData: FormData): Promise<string> {
  const input = parseListingForm(formData);
  const files = newPhotos(formData);
  if (files.length === 0) throw new UserError("Add at least one photo.");
  if (files.length > MAX_PHOTOS) throw new UserError(`You can add at most ${MAX_PHOTOS} photos.`);

  const filenames: string[] = [];
  try {
    for (const file of files) filenames.push(await saveImage(file));
    const pub = fuzzLocation(input);
    const listing = await db.listing.create({
      data: {
        ...input,
        ownerId,
        publicLat: pub.lat,
        publicLng: pub.lng,
        photos: { create: filenames.map((filename, position) => ({ filename, position })) },
      },
    });
    return listing.id;
  } catch (e) {
    await Promise.all(filenames.map(deleteImage));
    throw e;
  }
}

export async function updateListing(ownerId: string, listingId: string, formData: FormData) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, include: { photos: true } });
  if (!listing || listing.ownerId !== ownerId) throw new UserError("Costume not found.");
  const input = parseListingForm(formData);

  const keepIds = new Set(formData.getAll("keepPhotos").map(String));
  const kept = listing.photos.filter((p) => keepIds.has(p.id)).sort((a, b) => a.position - b.position);
  const removed = listing.photos.filter((p) => !keepIds.has(p.id));
  const files = newPhotos(formData);
  if (kept.length + files.length === 0) throw new UserError("Keep or add at least one photo.");
  if (kept.length + files.length > MAX_PHOTOS) throw new UserError(`You can have at most ${MAX_PHOTOS} photos.`);

  const moved = Math.abs(input.lat - listing.lat) > 1e-7 || Math.abs(input.lng - listing.lng) > 1e-7;
  const pub = moved ? fuzzLocation(input) : { lat: listing.publicLat, lng: listing.publicLng };

  const added: string[] = [];
  try {
    for (const file of files) added.push(await saveImage(file));
    await db.$transaction([
      db.photo.deleteMany({ where: { id: { in: removed.map((p) => p.id) } } }),
      ...kept.map((p, i) => db.photo.update({ where: { id: p.id }, data: { position: i } })),
      db.listing.update({
        where: { id: listingId },
        data: {
          ...input,
          active: formData.get("active") === "on",
          publicLat: pub.lat,
          publicLng: pub.lng,
          photos: { create: added.map((filename, i) => ({ filename, position: kept.length + i })) },
        },
      }),
    ]);
  } catch (e) {
    await Promise.all(added.map(deleteImage));
    throw e;
  }
  await Promise.all(removed.map((p) => deleteImage(p.filename)));
}

export async function setListingActive(ownerId: string, listingId: string, active: boolean) {
  const result = await db.listing.updateMany({ where: { id: listingId, ownerId }, data: { active } });
  if (result.count !== 1) throw new UserError("Costume not found.");
}

export async function deleteListing(ownerId: string, listingId: string) {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { photos: true, _count: { select: { bookings: true } } },
  });
  if (!listing || listing.ownerId !== ownerId) throw new UserError("Costume not found.");
  if (listing._count.bookings > 0) {
    throw new UserError("This costume has booking history, so it can't be deleted. Hide it instead.");
  }
  await db.listing.delete({ where: { id: listingId } });
  await Promise.all(listing.photos.map((p) => deleteImage(p.filename)));
}

// ---------------------------------------------------------------------------
// Search

export type SortOption = "nearest" | "newest" | "price-asc" | "price-desc";

export interface SearchFilters {
  q?: string;
  theme?: string;
  size?: string;
  maxPrice?: number;
  from?: string;
  to?: string;
  near?: LatLng;
  sort?: SortOption;
}

export async function searchListings(filters: SearchFilters, limit = 120) {
  const where: Prisma.ListingWhereInput = { active: true };
  if (filters.q) {
    where.OR = [{ title: { contains: filters.q } }, { description: { contains: filters.q } }];
  }
  if (filters.theme) where.theme = filters.theme;
  if (filters.size) where.size = filters.size;
  if (filters.maxPrice) where.price = { lte: filters.maxPrice };
  if (filters.from && filters.to && isISODate(filters.from) && isISODate(filters.to) && filters.from < filters.to) {
    where.bookings = {
      none: { status: { in: BLOCKING_STATUSES }, startDate: { lt: filters.to }, endDate: { gt: filters.from } },
    };
  }

  const sort = filters.sort ?? (filters.near ? "nearest" : "newest");
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    sort === "price-asc" ? { price: "asc" } : sort === "price-desc" ? { price: "desc" } : { createdAt: "desc" };

  const listings = await db.listing.findMany({
    where,
    orderBy,
    // Distance sorting happens in memory, so fetch everything that matches.
    take: sort === "nearest" ? undefined : limit,
    include: { photos: { orderBy: { position: "asc" }, take: 1 } },
  });

  const withDistance = listings.map((l) => ({
    ...l,
    distanceKm: filters.near ? distanceKm(filters.near, { lat: l.publicLat, lng: l.publicLng }) : null,
  }));
  if (sort === "nearest" && filters.near) {
    withDistance.sort((a, b) => a.distanceKm! - b.distanceKm!);
  }
  return withDistance.slice(0, limit);
}

export type ListingSummary = Awaited<ReturnType<typeof searchListings>>[number];

// ---------------------------------------------------------------------------
// Ratings

export interface RatingSummary {
  average: number;
  count: number;
}

export async function ratingsFor(userIds: string[]): Promise<Map<string, RatingSummary>> {
  const groups = await db.review.groupBy({
    by: ["subjectId"],
    where: { subjectId: { in: userIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.subjectId, { average: g._avg.rating ?? 0, count: g._count._all }]));
}
