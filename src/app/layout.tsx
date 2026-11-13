import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { isMockPayments } from "@/lib/payments";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${APP_NAME} – ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Peer-to-peer costume rentals for students in Lund. Rent a costume for the next sittning or party, or earn money on the ones you already own.",
};

export const viewport: Viewport = {
  themeColor: "#5a26d6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        {isMockPayments() && (
          <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
            Demo mode: payments are simulated. Add Stripe keys to <code>.env</code> to take real payments.
          </div>
        )}
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-stone-500 sm:flex-row sm:justify-between">
            <p>
              {APP_NAME} · {APP_TAGLINE.toLowerCase()}
            </p>
            <nav className="flex gap-4">
              <Link href="/how-it-works" className="hover:text-stone-800">
                How it works
              </Link>
              <Link href="/costumes" className="hover:text-stone-800">
                Browse
              </Link>
              <Link href="/costumes/new" className="hover:text-stone-800">
                Rent out a costume
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
