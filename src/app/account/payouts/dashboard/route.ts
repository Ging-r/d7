import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPayments } from "@/lib/payments";

export async function GET() {
  const user = await requireUser("/account");
  const url = user.stripeAccountId ? await getPayments().dashboardUrl(user.stripeAccountId) : null;
  redirect(url ?? "/account");
}
