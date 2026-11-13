import { sweepBookings } from "@/lib/bookings";

/** Lets a scheduler run timeouts and settlement retries even when nobody is browsing. */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await sweepBookings();
  return Response.json({ ok: true });
}

export { handler as GET, handler as POST };
