import type { Metadata } from "next";
import Link from "next/link";
import { AUTO_PICKUP_AFTER_DAYS, DAMAGE_REPORT_DAYS, PAYMENT_WINDOW_HOURS, PLATFORM_FEE_PERCENT } from "@/lib/config";

export const metadata: Metadata = { title: "How it works" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "When do I pay?",
    a: `Only after the owner accepts your request. You then have ${PAYMENT_WINDOW_HOURS} hours to pay, or the dates are released.`,
  },
  {
    q: "What if the owner doesn't show up?",
    a: `Cancel the booking before you confirm pickup and you get everything back. The owner only gets paid when you tap "I've got the costume" (or automatically ${AUTO_PICKUP_AFTER_DAYS} days after the pickup date if you neither confirm nor cancel).`,
  },
  {
    q: "How does the deposit work?",
    a: `The deposit is charged with the rental and held by us — not the owner. When the owner confirms the costume is back in good shape, it's refunded. If they don't respond within ${DAMAGE_REPORT_DAYS} days of the return date, it's refunded automatically.`,
  },
  {
    q: "What if something gets damaged?",
    a: "The owner can claim part or all of the deposit and explain what happened. An admin reads the chat from both sides and decides how to split it. The renter never pays more than the deposit.",
  },
  {
    q: "What does it cost to rent out a costume?",
    a: `Listing is free. We keep ${PLATFORM_FEE_PERCENT}% of the rental price when a costume is rented — never anything from the deposit.`,
  },
  {
    q: "Where do we meet?",
    a: "Owners drop a pin where they'd like to hand over. Renters see an approximate area until they've paid, then the exact pin. Agree on the time in the booking chat.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Before pickup, either side can cancel and the renter gets a full refund.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="page-title">How it works</h1>
      <ol className="card flex flex-col gap-4 p-5 text-sm">
        {[
          ["Request", "Pick a costume and your dates, and say hi to the owner."],
          ["Owner accepts", "They check the dates work for them."],
          ["Pay", "Pay the rental plus a refundable deposit, securely through the app."],
          ["Meet & pick up", "Agree on a time in the chat. Tap “I've got the costume” when you have it."],
          ["Party", "Have fun, and keep the costume in good shape."],
          ["Return", "Hand it back. The owner confirms and your deposit is refunded."],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
            <span>
              <strong>{title}.</strong> {text}
            </span>
          </li>
        ))}
      </ol>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Questions</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="card group p-4">
            <summary className="cursor-pointer font-medium">{f.q}</summary>
            <p className="mt-2 text-sm text-stone-600">{f.a}</p>
          </details>
        ))}
      </section>
      <div className="flex gap-2">
        <Link href="/costumes" className="btn-primary">
          Find a costume
        </Link>
        <Link href="/costumes/new" className="btn-secondary">
          Rent out yours
        </Link>
      </div>
    </div>
  );
}
