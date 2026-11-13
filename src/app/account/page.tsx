import type { Metadata } from "next";
import Link from "next/link";
import { startPayoutOnboardingAction, updateProfileAction } from "@/actions/account";
import { SubmitButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { ProfileForm } from "@/components/ProfileForm";
import { Alert, Section, Stat } from "@/components/ui";
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
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <h1 className="page-title">Account</h1>

      <Section
        title="Payouts"
        description={
          <>
            To rent out costumes you need a payout account, so we can send you your share ({100 - PLATFORM_FEE_PERCENT}% of each rental). It&apos;s run by
            Stripe, our payment provider, and takes a few minutes with BankID or your ID.
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {payouts === "pending" && !payoutsEnabled && (
            <Alert tone="warn">Stripe still needs a few details, or is reviewing them. You can continue where you left off below.</Alert>
          )}
          {payoutsEnabled ? (
            <>
              <Alert tone="good">Payouts are set up. You can accept rental requests.</Alert>
              <dl className="flex gap-12">
                <Stat label="Paid out so far" value={formatSEK(earnings._sum.ownerPayout ?? 0)} />
                <Stat label={earnings._count === 1 ? "Rental" : "Rentals"} value={earnings._count} />
              </dl>
              {!isMockPayments() && (
                <a href="/account/payouts/dashboard" className="btn-secondary self-start">
                  Open payout dashboard
                  <Icon name="arrow-up-right" />
                </a>
              )}
            </>
          ) : (
            <form action={startPayoutOnboardingAction}>
              <SubmitButton pendingText="Opening Stripe…">{user.stripeAccountId ? "Continue payout setup" : "Set up payouts"}</SubmitButton>
              {isMockPayments() && <p className="hint mt-2">Demo mode: this completes instantly.</p>}
            </form>
          )}
        </div>
      </Section>

      <Section
        title="Profile"
        description={
          <>
            Signed in as {user.email}.{" "}
            <Link href={`/users/${user.id}`} className="link text-ink">
              View public profile
            </Link>
          </>
        }
      >
        <ProfileForm action={updateProfileAction} name={user.name} bio={user.bio} />
      </Section>
    </div>
  );
}
