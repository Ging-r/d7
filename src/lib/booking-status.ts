// Pure booking definitions, safe to import from client components.
//
// Lifecycle:
//   REQUESTED ─owner accepts→ ACCEPTED ─renter pays→ PAID ─renter confirms pickup→ PICKED_UP
//   PICKED_UP ─owner confirms return→ COMPLETED (deposit refunded)
//   PICKED_UP ─owner reports damage→ DISPUTED ─admin resolves→ COMPLETED
// Side exits: DECLINED (owner), CANCELLED (either party, full refund if paid), EXPIRED (timeouts).

export const BookingStatus = {
  REQUESTED: "REQUESTED",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  PAID: "PAID",
  PICKED_UP: "PICKED_UP",
  DISPUTED: "DISPUTED",
  COMPLETED: "COMPLETED",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Statuses that reserve the costume's dates. */
export const BLOCKING_STATUSES: BookingStatus[] = ["ACCEPTED", "PAID", "PICKED_UP", "DISPUTED"];

/** Statuses after the renter has received the costume, when the owner is owed their payout. */
export const PICKED_UP_STATUSES: BookingStatus[] = ["PICKED_UP", "DISPUTED", "COMPLETED"];

export const CLOSED_STATUSES: BookingStatus[] = ["DECLINED", "CANCELLED", "EXPIRED", "COMPLETED"];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED: "Requested",
  ACCEPTED: "Awaiting payment",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  PAID: "Paid – ready for pickup",
  PICKED_UP: "Rented out",
  DISPUTED: "Damage claim",
  COMPLETED: "Completed",
};

export const STATUS_TONES: Record<BookingStatus, "neutral" | "warn" | "good" | "bad" | "info"> = {
  REQUESTED: "warn",
  ACCEPTED: "warn",
  DECLINED: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  PAID: "info",
  PICKED_UP: "info",
  DISPUTED: "bad",
  COMPLETED: "good",
};

export interface BookingMoney {
  status: string;
  rentalAmount: number;
  depositAmount: number;
  ownerPayout: number;
  claimPaidAmount: number | null;
  paymentIntentId: string | null;
  refundId: string | null;
  payoutTransferId: string | null;
  depositRefundId: string | null;
  claimTransferId: string | null;
}

export type MoneyOp =
  | { kind: "refund-all"; amount: number }
  | { kind: "payout"; amount: number }
  | { kind: "claim"; amount: number }
  | { kind: "deposit-refund"; amount: number };

/**
 * The money movements a booking's status implies but that haven't happened yet.
 * Settlement just executes these, so it is safe to retry at any time.
 */
export function dueMoneyOps(b: BookingMoney): MoneyOp[] {
  if (!b.paymentIntentId) return [];
  const status = b.status as BookingStatus;
  const ops: MoneyOp[] = [];
  if (status === "CANCELLED" && !b.refundId) {
    ops.push({ kind: "refund-all", amount: b.rentalAmount + b.depositAmount });
  }
  if (PICKED_UP_STATUSES.includes(status) && !b.payoutTransferId) {
    ops.push({ kind: "payout", amount: b.ownerPayout });
  }
  if (status === "COMPLETED") {
    const claimPaid = b.claimPaidAmount ?? 0;
    if (claimPaid > 0 && !b.claimTransferId) ops.push({ kind: "claim", amount: claimPaid });
    const depositRefund = b.depositAmount - claimPaid;
    if (depositRefund > 0 && !b.depositRefundId) ops.push({ kind: "deposit-refund", amount: depositRefund });
  }
  return ops;
}
