// Pure pricing helpers, shared by the server and the booking form preview.

export interface PricedListing {
  price: number;
  includedDays: number;
  extraDayPrice: number | null;
  deposit: number;
}

export interface Quote {
  days: number;
  extraDays: number;
  rentalAmount: number;
  depositAmount: number;
  platformFee: number;
  ownerPayout: number;
  total: number;
}

export function maxRentalDays(listing: PricedListing, hardLimit: number): number {
  return listing.extraDayPrice == null ? listing.includedDays : hardLimit;
}

export function quote(listing: PricedListing, days: number, feePercent: number): Quote {
  const extraDays = Math.max(0, days - listing.includedDays);
  const rentalAmount = listing.price + extraDays * (listing.extraDayPrice ?? 0);
  const platformFee = Math.round((rentalAmount * feePercent) / 100);
  return {
    days,
    extraDays,
    rentalAmount,
    depositAmount: listing.deposit,
    platformFee,
    ownerPayout: rentalAmount - platformFee,
    total: rentalAmount + listing.deposit,
  };
}

export function formatSEK(amount: number): string {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(amount)} kr`;
}

export function describePricing(listing: PricedListing): string {
  const base = `${formatSEK(listing.price)} for up to ${listing.includedDays} ${listing.includedDays === 1 ? "day" : "days"}`;
  return listing.extraDayPrice == null ? base : `${base}, then ${formatSEK(listing.extraDayPrice)}/day`;
}
