import Stripe from "stripe";
import { confirmCheckoutSession, notePaymentFailed } from "@/lib/bookings";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return new Response("Stripe webhooks are not configured", { status: 404 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Errors propagate as 500s so Stripe retries the delivery; handlers are idempotent.
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // confirmCheckoutSession only records the payment once payment_status is "paid".
      await confirmCheckoutSession(event.data.object.id);
      break;
    case "checkout.session.async_payment_failed": {
      const bookingId = event.data.object.metadata?.bookingId;
      if (bookingId) await notePaymentFailed(bookingId);
      break;
    }
  }
  return Response.json({ received: true });
}
