import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { APP_URL, CURRENCY } from "./config";

// All amounts at this boundary are whole SEK; Stripe wants öre.
const ORE = 100;

export interface CheckoutInput {
  bookingId: string;
  title: string;
  days: number;
  rentalAmount: number;
  depositAmount: number;
  customerEmail: string;
  expiresAt: Date;
}

export interface CheckoutInfo {
  bookingId: string | null;
  paid: boolean;
  open: boolean;
  url: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
}

export interface Payments {
  readonly mode: "stripe" | "mock";
  createConnectedAccount(user: { email: string; name: string }): Promise<string>;
  onboardingUrl(accountId: string): Promise<string>;
  payoutsEnabled(accountId: string): Promise<boolean>;
  dashboardUrl(accountId: string): Promise<string | null>;
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  getCheckout(sessionId: string): Promise<CheckoutInfo>;
  /** Pays `amount` from the booking's charge to an owner's connected account. */
  transfer(input: {
    bookingId: string;
    amount: number;
    destination: string;
    chargeId: string;
    idempotencyKey: string;
  }): Promise<string>;
  refund(input: { paymentIntentId: string; amount: number; idempotencyKey: string }): Promise<string>;
}

class StripePayments implements Payments {
  readonly mode = "stripe" as const;

  constructor(private stripe: Stripe) {}

  // Owners are Accounts v2 "recipients": they only receive transfers from the
  // platform, which is the merchant of record and carries fees and losses.
  async createConnectedAccount(user: { email: string; name: string }) {
    const account = await this.stripe.v2.core.accounts.create({
      contact_email: user.email,
      display_name: user.name,
      dashboard: "express",
      identity: { country: "SE", entity_type: "individual" },
      defaults: {
        currency: CURRENCY,
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
    });
    return account.id;
  }

  async onboardingUrl(accountId: string) {
    const link = await this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          return_url: `${APP_URL}/account/payouts/return`,
          refresh_url: `${APP_URL}/account/payouts/start`,
        },
      },
    });
    return link.url;
  }

  async payoutsEnabled(accountId: string) {
    const account = await this.stripe.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
    return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
  }

  async dashboardUrl(accountId: string) {
    const link = await this.stripe.accounts.createLoginLink(accountId);
    return link.url;
  }

  async createCheckout(input: CheckoutInput) {
    // Stripe accepts expiry between 30 minutes and 24 hours from now.
    const now = Date.now();
    const expiresAt = Math.min(Math.max(input.expiresAt.getTime(), now + 31 * 60_000), now + 23.5 * 3_600_000);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: input.rentalAmount * ORE,
          product_data: {
            name: `Costume rental: ${input.title}`,
            description: `${input.days} ${input.days === 1 ? "day" : "days"}`,
          },
        },
      },
    ];
    if (input.depositAmount > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: input.depositAmount * ORE,
          product_data: {
            name: "Refundable deposit",
            description: "Refunded when the costume is returned in good condition",
          },
        },
      });
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: "costume_rental_qmvhtzkd",
      line_items: lineItems,
      customer_email: input.customerEmail,
      client_reference_id: input.bookingId,
      metadata: { bookingId: input.bookingId },
      payment_intent_data: {
        transfer_group: `booking_${input.bookingId}`,
        metadata: { bookingId: input.bookingId },
      },
      expires_at: Math.floor(expiresAt / 1000),
      success_url: `${APP_URL}/bookings/${input.bookingId}/paid?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/bookings/${input.bookingId}`,
    });
    return { id: session.id, url: session.url! };
  }

  async getCheckout(sessionId: string): Promise<CheckoutInfo> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
    const pi = session.payment_intent;
    const paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? null);
    let chargeId: string | null = null;
    if (pi && typeof pi !== "string") {
      chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
    }
    return {
      bookingId: session.metadata?.bookingId ?? null,
      paid: session.payment_status === "paid",
      open: session.status === "open",
      url: session.url,
      paymentIntentId,
      chargeId,
    };
  }

  async transfer(input: { bookingId: string; amount: number; destination: string; chargeId: string; idempotencyKey: string }) {
    const transfer = await this.stripe.transfers.create(
      {
        amount: input.amount * ORE,
        currency: CURRENCY,
        destination: input.destination,
        // Ties the transfer to the renter's charge so it works before the funds settle.
        source_transaction: input.chargeId,
        transfer_group: `booking_${input.bookingId}`,
        metadata: { bookingId: input.bookingId },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return transfer.id;
  }

  async refund(input: { paymentIntentId: string; amount: number; idempotencyKey: string }) {
    const refund = await this.stripe.refunds.create(
      { payment_intent: input.paymentIntentId, amount: input.amount * ORE },
      { idempotencyKey: input.idempotencyKey },
    );
    return refund.id;
  }
}

/** Demo mode: every money movement succeeds instantly and nothing leaves the app. */
class MockPayments implements Payments {
  readonly mode = "mock" as const;

  private id(prefix: string) {
    return `mock_${prefix}_${randomBytes(6).toString("hex")}`;
  }

  async createConnectedAccount() {
    return this.id("acct");
  }

  async onboardingUrl() {
    return `${APP_URL}/account/payouts/return`;
  }

  async payoutsEnabled() {
    return true;
  }

  async dashboardUrl() {
    return null;
  }

  async createCheckout(input: CheckoutInput) {
    const id = this.id("cs");
    return { id, url: `${APP_URL}/mock-checkout/${input.bookingId}?session=${id}` };
  }

  async getCheckout(): Promise<CheckoutInfo> {
    // Mock sessions are completed by the mock checkout page, never looked up.
    return { bookingId: null, paid: false, open: false, url: null, paymentIntentId: null, chargeId: null };
  }

  async transfer() {
    return this.id("tr");
  }

  async refund() {
    return this.id("re");
  }
}

let instance: Payments | null = null;

export function getPayments(): Payments {
  if (!instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    instance = key ? new StripePayments(new Stripe(key)) : new MockPayments();
  }
  return instance;
}

export function isMockPayments() {
  return getPayments().mode === "mock";
}

/** Lets tests swap in a fake that records or fails calls. */
export function setPaymentsForTesting(payments: Payments | null) {
  instance = payments;
}
