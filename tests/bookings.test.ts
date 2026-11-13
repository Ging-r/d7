import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  acceptBooking,
  cancelBooking,
  confirmPickup,
  confirmReturn,
  recordPayment,
  reportDamage,
  requestBooking,
  resolveClaim,
  startCheckout,
  submitReview,
  sweepBookings,
} from "@/lib/bookings";
import { addDays, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { setPaymentsForTesting, type Payments } from "@/lib/payments";

type Call = { kind: "checkout" | "transfer" | "refund"; amount: number; key?: string; destination?: string };

class FakePayments implements Payments {
  readonly mode = "mock" as const;
  calls: Call[] = [];
  failTransfers = 0;
  private seen = new Map<string, string>();
  private n = 0;

  private idem(key: string, make: () => string) {
    // Mirrors Stripe: the same idempotency key returns the original result.
    if (!this.seen.has(key)) this.seen.set(key, make());
    return this.seen.get(key)!;
  }

  async createConnectedAccount() {
    return `acct_${++this.n}`;
  }
  async onboardingUrl() {
    return "/";
  }
  transfersActive = true;
  async payoutsEnabled() {
    return this.transfersActive;
  }
  async dashboardUrl() {
    return null;
  }
  async createCheckout(input: { rentalAmount: number; depositAmount: number }) {
    this.calls.push({ kind: "checkout", amount: input.rentalAmount + input.depositAmount });
    return { id: `cs_${++this.n}`, url: "https://checkout.test" };
  }
  async getCheckout() {
    return { bookingId: null, paid: false, open: false, url: null, paymentIntentId: null, chargeId: null };
  }
  async transfer(input: { amount: number; destination: string; idempotencyKey: string }) {
    if (this.failTransfers > 0) {
      this.failTransfers--;
      throw new Error("Stripe is down");
    }
    return this.idem(input.idempotencyKey, () => {
      this.calls.push({ kind: "transfer", amount: input.amount, key: input.idempotencyKey, destination: input.destination });
      return `tr_${++this.n}`;
    });
  }
  async refund(input: { amount: number; idempotencyKey: string }) {
    return this.idem(input.idempotencyKey, () => {
      this.calls.push({ kind: "refund", amount: input.amount, key: input.idempotencyKey });
      return `re_${++this.n}`;
    });
  }
  moved(kind: "transfer" | "refund") {
    return this.calls.filter((c) => c.kind === kind).map((c) => c.amount);
  }
}

let payments: FakePayments;
let owner: { id: string };
let renter: { id: string };
let otherRenter: { id: string };
let listingId: string;
const today = todayISO();
const day = (n: number) => addDays(today, n);

async function makeUser(name: string, payouts = true) {
  return db.user.create({
    data: {
      email: `${name}-${Math.random().toString(36).slice(2)}@test.se`,
      name,
      passwordHash: "x",
      stripeAccountId: payouts ? `acct_${name}` : null,
      payoutsEnabled: payouts,
    },
  });
}

async function request(renterId = renter.id, start = day(2), end = day(4)) {
  return requestBooking({ renterId, listingId, startDate: start, endDate: end, message: "Hi! Can I rent it?" });
}

async function pay(bookingId: string) {
  await startCheckout(renter.id, bookingId);
  await recordPayment({ bookingId, sessionId: `cs_${bookingId}`, paymentIntentId: `pi_${bookingId}`, chargeId: `ch_${bookingId}` });
}

async function status(id: string) {
  return (await db.booking.findUniqueOrThrow({ where: { id } })).status;
}

beforeEach(async () => {
  // The sweep acts on every booking, so each test starts from an empty database.
  await db.review.deleteMany();
  await db.message.deleteMany();
  await db.booking.deleteMany();
  await db.listing.deleteMany();
  await db.user.deleteMany();
  payments = new FakePayments();
  setPaymentsForTesting(payments);
  owner = await makeUser("owner");
  renter = await makeUser("renter", false);
  otherRenter = await makeUser("other", false);
  const listing = await db.listing.create({
    data: {
      ownerId: owner.id,
      title: "Pirate captain",
      description: "Hat, coat and a plastic sword",
      theme: "fantasy",
      size: "M",
      price: 150,
      includedDays: 3,
      extraDayPrice: 40,
      deposit: 300,
      lat: 55.7,
      lng: 13.19,
      publicLat: 55.7,
      publicLng: 13.19,
    },
  });
  listingId = listing.id;
});

afterAll(() => setPaymentsForTesting(null));

describe("booking lifecycle", () => {
  it("runs request → accept → pay → pickup → return, moving money at each step", async () => {
    const id = await request();
    const booking = await db.booking.findUniqueOrThrow({ where: { id }, include: { messages: true } });
    expect(booking).toMatchObject({ status: "REQUESTED", days: 2, rentalAmount: 150, depositAmount: 300, platformFee: 15, ownerPayout: 135 });
    expect(booking.messages.map((m) => m.body)).toContain("Hi! Can I rent it?");

    await acceptBooking(owner.id, id);
    expect(await status(id)).toBe("ACCEPTED");

    await pay(id);
    expect(await status(id)).toBe("PAID");
    expect(payments.calls).toEqual([{ kind: "checkout", amount: 450 }]);

    await confirmPickup(renter.id, id);
    expect(await status(id)).toBe("PICKED_UP");
    expect(payments.calls.at(-1)).toMatchObject({ kind: "transfer", amount: 135, destination: "acct_owner" });

    await confirmReturn(owner.id, id);
    expect(await status(id)).toBe("COMPLETED");
    expect(payments.moved("refund")).toEqual([300]);

    await submitReview(renter.id, id, 5, "Great costume!");
    await submitReview(owner.id, id, 4, "");
    await expect(submitReview(renter.id, id, 5, "again")).rejects.toThrow(UserError);
    expect(await db.review.count({ where: { bookingId: id } })).toBe(2);
  });

  it("requires the owner to set up payouts before accepting", async () => {
    await db.user.update({ where: { id: owner.id }, data: { payoutsEnabled: false, stripeAccountId: null } });
    const id = await request();
    await expect(acceptBooking(owner.id, id)).rejects.toThrow(/payouts/);
    expect(await status(id)).toBe("REQUESTED");
  });

  it("re-checks Stripe when the owner's onboarding was still pending", async () => {
    await db.user.update({ where: { id: owner.id }, data: { payoutsEnabled: false } });
    const id = await request();
    payments.transfersActive = false;
    await expect(acceptBooking(owner.id, id)).rejects.toThrow(/payouts/);
    payments.transfersActive = true;
    await acceptBooking(owner.id, id);
    expect(await status(id)).toBe("ACCEPTED");
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).payoutsEnabled).toBe(true);
  });

  it("rejects invalid requests", async () => {
    await expect(request(owner.id)).rejects.toThrow(/own costume/);
    await expect(request(renter.id, day(-1), day(1))).rejects.toThrow(/past/);
    await expect(request(renter.id, day(3), day(3))).rejects.toThrow(/after the pickup/);
    await db.listing.update({ where: { id: listingId }, data: { extraDayPrice: null } });
    await expect(request(renter.id, day(1), day(5))).rejects.toThrow(/at most 3 days/);
  });

  it("blocks overlapping dates and declines competing requests on accept", async () => {
    const first = await request(renter.id, day(2), day(4));
    const overlapping = await request(otherRenter.id, day(3), day(5));
    const sameReturnDay = await request(otherRenter.id, day(4), day(6));

    await acceptBooking(owner.id, first);
    expect(await status(overlapping)).toBe("DECLINED");
    expect(await status(sameReturnDay)).toBe("REQUESTED");
    await expect(request(otherRenter.id, day(1), day(3))).rejects.toThrow(/already booked/);
  });

  it("can't apply the same transition twice", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    const results = await Promise.allSettled([confirmPickup(renter.id, id), confirmPickup(renter.id, id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(payments.moved("transfer")).toEqual([135]);
  });

  it("only lets participants act on a booking", async () => {
    const id = await request();
    await expect(acceptBooking(renter.id, id)).rejects.toThrow(/not found/);
    await expect(cancelBooking(otherRenter.id, id)).rejects.toThrow(/not found/);
  });
});

describe("cancellations and refunds", () => {
  it("refunds everything when a paid booking is cancelled before pickup", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    await cancelBooking(owner.id, id);
    expect(await status(id)).toBe("CANCELLED");
    expect(payments.moved("refund")).toEqual([450]);
    expect(payments.moved("transfer")).toEqual([]);
  });

  it("refunds a payment that arrives after the booking was cancelled", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await startCheckout(renter.id, id);
    await cancelBooking(renter.id, id);
    await recordPayment({ bookingId: id, sessionId: "cs_late", paymentIntentId: "pi_late", chargeId: "ch_late" });
    expect(await status(id)).toBe("CANCELLED");
    expect(payments.moved("refund")).toEqual([450]);
  });

  it("ignores a repeated payment notification", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    await recordPayment({ bookingId: id, sessionId: `cs_${id}`, paymentIntentId: `pi_${id}`, chargeId: `ch_${id}` });
    expect(await status(id)).toBe("PAID");
    expect(payments.moved("refund")).toEqual([]);
  });

  it("doesn't let the renter cancel after pickup", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    await confirmPickup(renter.id, id);
    await expect(cancelBooking(renter.id, id)).rejects.toThrow(/can't be cancelled/);
  });
});

describe("damage claims", () => {
  it("splits the deposit as the admin decides", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    await confirmPickup(renter.id, id);

    await expect(reportDamage(owner.id, id, 301, "The sleeve is torn off")).rejects.toThrow(/between/);
    await reportDamage(owner.id, id, 200, "The sleeve is torn off");
    expect(await status(id)).toBe("DISPUTED");

    await expect(resolveClaim(id, 250, "")).rejects.toThrow(/between/);
    await resolveClaim(id, 120, "Repair cost per receipt");
    expect(await status(id)).toBe("COMPLETED");
    expect(payments.moved("transfer")).toEqual([135, 120]);
    expect(payments.moved("refund")).toEqual([180]);
  });
});

describe("sweep", () => {
  it("expires unanswered requests and unpaid acceptances", async () => {
    const unanswered = await request(renter.id, day(1), day(2));
    const unpaid = await request(otherRenter.id, day(5), day(6));
    await acceptBooking(owner.id, unpaid);

    await sweepBookings(new Date(Date.now() + 3 * 24 * 3_600_000));
    expect(await status(unanswered)).toBe("EXPIRED");
    expect(await status(unpaid)).toBe("EXPIRED");
  });

  it("confirms pickup and completes rentals automatically", async () => {
    const id = await request(renter.id, day(1), day(2));
    await acceptBooking(owner.id, id);
    await pay(id);

    await sweepBookings(new Date(Date.now() + 3 * 24 * 3_600_000));
    expect(await status(id)).toBe("PICKED_UP");
    expect(payments.moved("transfer")).toEqual([135]);

    await sweepBookings(new Date(Date.now() + 6 * 24 * 3_600_000));
    expect(await status(id)).toBe("COMPLETED");
    expect(payments.moved("refund")).toEqual([300]);
  });

  it("retries failed payouts without paying twice", async () => {
    const id = await request();
    await acceptBooking(owner.id, id);
    await pay(id);
    payments.failTransfers = 1;
    await confirmPickup(renter.id, id);

    let booking = await db.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.status).toBe("PICKED_UP");
    expect(booking.payoutTransferId).toBeNull();
    expect(booking.settlementError).toMatch(/Stripe is down/);

    await sweepBookings();
    await sweepBookings();
    booking = await db.booking.findUniqueOrThrow({ where: { id } });
    expect(booking.payoutTransferId).not.toBeNull();
    expect(booking.settlementError).toBeNull();
    expect(payments.moved("transfer")).toEqual([135]);
  });
});
