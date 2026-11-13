import type { Metadata } from "next";
import Link from "next/link";
import { createListingAction } from "@/actions/listings";
import { EMPTY_LISTING, ListingForm } from "@/components/ListingForm";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/config";

export const metadata: Metadata = { title: "Rent out a costume" };

export default async function NewCostumePage() {
  const user = await requireUser("/costumes/new");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="page-title">Rent out a costume</h1>
        <p className="mt-3 text-lg text-ink-soft">Earn back what you paid for it. Listing takes a couple of minutes and costs nothing.</p>
      </div>
      {!user.payoutsEnabled && (
        <Alert tone="info">
          You can publish now, but you&apos;ll need to <Link href="/account" className="link">set up payouts</Link> before you can
          accept your first request.
        </Alert>
      )}
      <ListingForm action={createListingAction} initial={EMPTY_LISTING} feePercent={PLATFORM_FEE_PERCENT} mode="create" />
    </div>
  );
}
