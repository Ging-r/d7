import { db } from "./db";
import { getPayments } from "./payments";

/** Re-reads the owner's Stripe capability status and stores it. Returns whether transfers are active. */
export async function refreshPayoutStatus(user: { id: string; stripeAccountId: string | null; payoutsEnabled: boolean }) {
  if (!user.stripeAccountId) return false;
  const enabled = await getPayments().payoutsEnabled(user.stripeAccountId);
  if (enabled !== user.payoutsEnabled) {
    await db.user.update({ where: { id: user.id }, data: { payoutsEnabled: enabled } });
  }
  return enabled;
}

export async function ensureConnectedAccount(user: { id: string; email: string; name: string; stripeAccountId: string | null }) {
  if (user.stripeAccountId) return user.stripeAccountId;
  const accountId = await getPayments().createConnectedAccount({ email: user.email, name: user.name });
  await db.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
  return accountId;
}
