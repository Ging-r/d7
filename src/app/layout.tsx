import type { Metadata, Viewport } from "next";
import { League_Gothic, Libre_Franklin } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Logo } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { isMockPayments } from "@/lib/payments";
import "./globals.css";

// Headlines are set like a party poster, everything else in a plain newspaper sans.
const gothic = League_Gothic({ weight: "400", subsets: ["latin"], variable: "--font-gothic" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} – ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Peer-to-peer costume rentals for students in Lund. Rent a costume for the next sittning or party, or earn money on the ones you already own.",
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${gothic.variable} ${franklin.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {isMockPayments() && (
          <div className="bg-ink px-4 py-2 text-center text-xs text-paper">
            <span className="mr-2 rounded-sm bg-tag px-1.5 py-0.5 font-semibold tracking-wide text-ink uppercase">Demo</span>
            Payments are simulated. Add Stripe keys to <code>.env</code> to take real payments.
          </div>
        )}
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1fr_auto_auto] sm:gap-20">
            <div>
              <Logo className="text-3xl" />
              <p className="mt-3 max-w-xs text-sm text-paper/70">{APP_TAGLINE}. The costume for your next sittning is already hanging in someone&apos;s wardrobe.</p>
            </div>
            <FooterNav title="Rent">
              <FooterLink href="/costumes">Browse costumes</FooterLink>
              <FooterLink href="/how-it-works">How it works</FooterLink>
              <FooterLink href="/bookings">Your bookings</FooterLink>
            </FooterNav>
            <FooterNav title="Rent out">
              <FooterLink href="/costumes/new">Rent out a costume</FooterLink>
              <FooterLink href="/my-costumes">My costumes</FooterLink>
              <FooterLink href="/account">Account &amp; payouts</FooterLink>
            </FooterNav>
          </div>
          <p className="mx-auto max-w-6xl border-t border-paper/15 px-4 py-5 text-xs text-paper/60">Made by students in Lund, for students in Lund.</p>
        </footer>
      </body>
    </html>
  );
}

function FooterNav({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="eyebrow text-paper/60">{title}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="underline-offset-4 hover:text-tag hover:underline">
        {children}
      </Link>
    </li>
  );
}
