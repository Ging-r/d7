import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteListingAction, updateListingAction } from "@/actions/listings";
import { ActionButton } from "@/components/forms";
import { ListingForm } from "@/components/ListingForm";
import { BackLink } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/config";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit costume" };

export default async function EditCostumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/costumes/${id}/edit`);
  const listing = await db.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" } }, _count: { select: { bookings: true } } },
  });
  if (!listing || listing.ownerId !== user.id) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <BackLink href={`/costumes/${listing.id}`}>Back to the costume</BackLink>
      <h1 className="page-title">Edit costume</h1>
      <ListingForm
        action={updateListingAction.bind(null, listing.id)}
        initial={{
          title: listing.title,
          description: listing.description,
          theme: listing.theme,
          size: listing.size,
          price: listing.price,
          includedDays: listing.includedDays,
          extraDayPrice: listing.extraDayPrice ?? "",
          deposit: listing.deposit,
          value: listing.value ?? "",
          areaLabel: listing.areaLabel,
          lat: listing.lat,
          lng: listing.lng,
          active: listing.active,
          photos: listing.photos.map((p) => ({ id: p.id, filename: p.filename })),
        }}
        feePercent={PLATFORM_FEE_PERCENT}
        mode="edit"
      />
      <p className="text-sm text-muted">Price changes only apply to new requests. Existing bookings keep the price they were made at.</p>
      {listing._count.bookings === 0 && (
        <div className="border-t border-line pt-6">
          <ActionButton
            action={deleteListingAction.bind(null, listing.id)}
            confirm="Delete this costume permanently?"
            className="btn-danger"
            pendingText="Deleting…"
          >
            Delete costume
          </ActionButton>
        </div>
      )}
    </div>
  );
}
