import type { Metadata } from "next";
import Link from "next/link";
import { startPayoutOnboardingAction, updateProfileAction } from "@/actions/account";
import { SubmitButton } from "@/components/forms";
import { ProfileForm } from "@/components/ProfileForm";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/config";
import { db } from "@/lib/db";
import { isMockPayments } from "@/lib/payments";
import { refreshPayoutStatus } from "@/lib/payouts";
import { formatSEK } from "@/lib/pricing";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ payouts?: string }> }) {
  const user = await requireUser("/account");
  const { payouts } = await searchParams;
  // Onboarding can finish asynchronously, so re-check while it's pending.
  const payoutsEnabled = user.payoutsEnabled || (user.stripeAccountId ? await refreshPayoutStatus(user) : false);
  const earnings = await db.booking.aggregate({
    where: { ownerId: user.id, payoutTransferId: { not: null } },
    _sum: { ownerPayout: true },
    _count: true,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="page-title">Account</h1>

      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Payouts</h2>
          <p className="text-sm text-stone-600">
            To rent out costumes you need a payout account, so we can send you your share ({100 - PLATFORM_FEE_PERCENT}% of each rental). It&apos;s run
            by Stripe, our payment provider, and takes a few minutes with BankID or your ID.
          </p>
        </div>
        {payouts === "pending" && !payoutsEnabled && (
          <Alert tone="warn">Stripe still needs a few details, or is reviewing them. You can continue where you left off below.</Alert>
        )}
        {payoutsEnabled ? (
          <>
            <Alert tone="good">✓ Payouts are set up. You can accept rental requests.</Alert>
            <p className="text-sm text-stone-600">
              Paid out so far: <strong>{formatSEK(earnings._sum.ownerPayout ?? 0)}</strong> from {earnings._count}{" "}
              {earnings._count === 1 ? "rental" : "rentals"}.
            </p>
            {!isMockPayments() && (
              <a href="/account/payouts/dashboard" className="btn-secondary self-start">
                Open payout dashboard ↗
              </a>
            )}
          </>
        ) : (
          <form action={startPayoutOnboardingAction}>
            <SubmitButton pendingText="Opening Stripe…">{user.stripeAccountId ? "Continue payout setup" : "Set up payouts"}</SubmitButton>
            {isMockPayments() && <p className="hint mt-2">Demo mode: this completes instantly.</p>}
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <ProfileForm action={updateProfileAction} name={user.name} bio={user.bio} />
        <p className="mt-4 text-sm text-stone-500">
          Signed in as {user.email} ·{" "}
          <Link href={`/users/${user.id}`} className="text-brand-700 hover:underline">
            View public profile
          </Link>
        </p>
      </section>
    </div>
  );
}
