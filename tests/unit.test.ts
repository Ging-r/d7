import { describe, expect, it } from "vitest";
import { dueMoneyOps, type BookingMoney } from "@/lib/booking-status";
import { addDays, daysBetween, isISODate, rangesOverlap, todayISO } from "@/lib/dates";
import { distanceKm, fuzzLocation } from "@/lib/geo";
import { maxRentalDays, quote } from "@/lib/pricing";

describe("pricing", () => {
  const listing = { price: 150, includedDays: 3, extraDayPrice: 40, deposit: 300 };

  it("charges the flat price within the included days", () => {
    expect(quote(listing, 1, 10)).toMatchObject({ rentalAmount: 150, extraDays: 0, platformFee: 15, ownerPayout: 135, total: 450 });
    expect(quote(listing, 3, 10).rentalAmount).toBe(150);
  });

  it("adds the extra-day price beyond the included days", () => {
    expect(quote(listing, 5, 10)).toMatchObject({ rentalAmount: 230, extraDays: 2, platformFee: 23, ownerPayout: 207 });
  });

  it("never takes a fee from the deposit", () => {
    expect(quote({ ...listing, deposit: 1000 }, 1, 10).platformFee).toBe(15);
  });

  it("limits rentals to the included days when there is no extra-day price", () => {
    expect(maxRentalDays({ ...listing, extraDayPrice: null }, 30)).toBe(3);
    expect(maxRentalDays(listing, 30)).toBe(30);
  });
});

describe("dates", () => {
  it("uses Swedish local time for today", () => {
    // 23:30 UTC on 28 March is already 29 March in Stockholm.
    expect(todayISO(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-29");
  });

  it("counts days across DST changes", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("validates dates", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-1-01")).toBe(false);
  });

  it("lets a return day be the next pickup day", () => {
    expect(rangesOverlap("2026-11-13", "2026-11-15", "2026-11-15", "2026-11-17")).toBe(false);
    expect(rangesOverlap("2026-11-13", "2026-11-16", "2026-11-15", "2026-11-17")).toBe(true);
  });
});

describe("geo", () => {
  it("measures distance in Lund", () => {
    // Lund C to LTH is roughly 2 km.
    const km = distanceKm({ lat: 55.7058, lng: 13.1868 }, { lat: 55.7122, lng: 13.2097 });
    expect(km).toBeGreaterThan(1.4);
    expect(km).toBeLessThan(2);
  });

  it("keeps fuzzed locations within the radius", () => {
    const origin = { lat: 55.7047, lng: 13.191 };
    for (let i = 0; i < 100; i++) {
      expect(distanceKm(origin, fuzzLocation(origin, 250)) * 1000).toBeLessThanOrEqual(251);
    }
  });
});

describe("dueMoneyOps", () => {
  const base: BookingMoney = {
    status: "PAID",
    rentalAmount: 150,
    depositAmount: 300,
    ownerPayout: 135,
    claimPaidAmount: null,
    paymentIntentId: "pi_1",
    refundId: null,
    payoutTransferId: null,
    depositRefundId: null,
    claimTransferId: null,
  };

  it("owes nothing before pickup or without a payment", () => {
    expect(dueMoneyOps(base)).toEqual([]);
    expect(dueMoneyOps({ ...base, status: "CANCELLED", paymentIntentId: null })).toEqual([]);
  });

  it("refunds everything on a paid cancellation", () => {
    expect(dueMoneyOps({ ...base, status: "CANCELLED" })).toEqual([{ kind: "refund-all", amount: 450 }]);
  });

  it("pays the owner after pickup, then refunds the deposit on completion", () => {
    expect(dueMoneyOps({ ...base, status: "PICKED_UP" })).toEqual([{ kind: "payout", amount: 135 }]);
    expect(dueMoneyOps({ ...base, status: "COMPLETED", payoutTransferId: "tr_1" })).toEqual([
      { kind: "deposit-refund", amount: 300 },
    ]);
  });

  it("splits the deposit after a resolved claim", () => {
    expect(dueMoneyOps({ ...base, status: "COMPLETED", payoutTransferId: "tr_1", claimPaidAmount: 300 })).toEqual([
      { kind: "claim", amount: 300 },
    ]);
    expect(dueMoneyOps({ ...base, status: "COMPLETED", payoutTransferId: "tr_1", claimPaidAmount: 100 })).toEqual([
      { kind: "claim", amount: 100 },
      { kind: "deposit-refund", amount: 200 },
    ]);
  });
});
