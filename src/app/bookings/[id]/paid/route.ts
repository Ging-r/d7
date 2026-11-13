import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { confirmCheckoutSession } from "@/lib/bookings";

/**
 * Stripe Checkout's success URL. The webhook is the source of truth; checking
 * here as well just makes the booking page show "Paid" right away.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/bookings/${id}`);
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (sessionId) {
    try {
      await confirmCheckoutSession(sessionId);
    } catch (e) {
      console.error("[checkout return]", e);
    }
  }
  redirect(`/bookings/${id}`);
}
