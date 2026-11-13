import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { refreshPayoutStatus } from "@/lib/payouts";

export async function GET() {
  const user = await requireUser("/account");
  const enabled = await refreshPayoutStatus(user);
  redirect(enabled ? "/account?payouts=ready" : "/account?payouts=pending");
}
