import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
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
    a: `The deposit is charged with the rental and held by us, not the owner. When the owner confirms the costume is back in good shape, it's refunded. If they don't respond within ${DAMAGE_REPORT_DAYS} days of the return date, it's refunded automatically.`,
  },
  {
    q: "What if something gets damaged?",
    a: "The owner can claim part or all of the deposit and explain what happened. An admin reads the chat from both sides and decides how to split it. The renter never pays more than the deposit.",
  },
  {
    q: "What does it cost to rent out a costume?",
    a: `Listing is free. We keep ${PLATFORM_FEE_PERCENT}% of the rental price when a costume is rented, and never anything from the deposit.`,
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

const STEPS = [
  ["Request", "Pick a costume and your dates, and say hi to the owner."],
  ["Owner accepts", "They check the dates work for them."],
  ["Pay", "Pay the rental plus a refundable deposit, securely through the app."],
  ["Meet & pick up", "Agree on a time in the chat. Tap “I've got the costume” when you have it."],
  ["Party", "Have fun, and keep the costume in good shape."],
  ["Return", "Hand it back. The owner confirms and your deposit is refunded."],
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12">
      <div>
        <h1 className="page-title">How it works</h1>
        <p className="mt-3 max-w-prose text-lg text-ink-soft">
          From request to return in six steps. You never pay before the owner says yes, and we hold the deposit until the costume is back.
        </p>
      </div>
      <ol className="border-t-[3px] border-ink">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="grid grid-cols-[3rem_1fr] items-baseline gap-x-2 border-b border-line py-4 sm:grid-cols-[4rem_12rem_1fr]">
            <span aria-hidden className="display text-5xl">
              {i + 1}
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="col-start-2 text-ink-soft sm:col-start-3">{text}</p>
          </li>
        ))}
      </ol>
      <section>
        <h2 className="section-title">Questions</h2>
        <div className="mt-4 border-t-[3px] border-ink">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-line">
              <summary className="flex list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="plus" className="size-5 transition-transform group-open:rotate-45" />
              </summary>
              <p className="max-w-prose pb-5 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href="/costumes" className="btn-primary btn-lg">
          Find a costume
        </Link>
        <Link href="/costumes/new" className="btn-secondary btn-lg">
          Rent out yours
        </Link>
      </div>
    </div>
  );
}
