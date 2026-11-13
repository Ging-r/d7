import Link from "next/link";
import { logout } from "@/actions/auth";
import { AccountMenu } from "@/components/AccountMenu";
import { getCurrentUser } from "@/lib/auth";
import { bookingsNeedingAttention } from "@/lib/bookings";
import { APP_NAME } from "@/lib/config";

export async function Header() {
  const user = await getCurrentUser();
  const attention = user ? (await bookingsNeedingAttention(user.id)).size : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto flex items-center gap-2 font-bold tracking-tight text-brand-800">
          <span aria-hidden className="text-xl">
            🎭
          </span>
          <span>{APP_NAME}</span>
        </Link>
        <Link href="/costumes" className="btn-ghost hidden sm:inline-flex">
          Browse
        </Link>
        {user ? (
          <>
            <Link href="/bookings" className="btn-ghost relative">
              Bookings
              {attention > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 text-xs leading-5 text-white" aria-label={`${attention} need attention`}>
                  {attention}
                </span>
              )}
            </Link>
            <AccountMenu initial={user.name.slice(0, 1).toUpperCase()}>
              <MenuLink href="/costumes">Browse costumes</MenuLink>
              <MenuLink href="/costumes/new">Rent out a costume</MenuLink>
              <MenuLink href="/my-costumes">My costumes</MenuLink>
              <MenuLink href={`/users/${user.id}`}>My profile</MenuLink>
              <MenuLink href="/account">Account & payouts</MenuLink>
              {user.isAdmin && <MenuLink href="/admin">Admin</MenuLink>}
              <form action={logout} className="border-t border-stone-100">
                <button className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">Log out</button>
              </form>
            </AccountMenu>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
      {children}
    </Link>
  );
}
