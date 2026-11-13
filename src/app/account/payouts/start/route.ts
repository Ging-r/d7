import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPayments } from "@/lib/payments";

/**
 * Stripe sends owners here when an onboarding link expires. Creating the
 * account happens in a POST action on the account page, so this only resumes.
 */
export async function GET() {
  const user = await requireUser("/account");
  if (!user.stripeAccountId) redirect("/account");
  redirect(await getPayments().onboardingUrl(user.stripeAccountId));
}
