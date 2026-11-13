import Link from "next/link";
import { logout } from "@/actions/auth";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { bookingsNeedingAttention } from "@/lib/bookings";

export async function Header() {
  const user = await getCurrentUser();
  const attention = user ? (await bookingsNeedingAttention(user.id)).size : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-4">
        <Link href="/" className="mr-auto">
          <Logo className="text-2xl sm:text-[1.7rem]" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href="/costumes" className="btn-ghost">
            Browse
          </Link>
          <Link href="/how-it-works" className="btn-ghost">
            How it works
          </Link>
          <Link href="/costumes/new" className="btn-ghost">
            Rent out a costume
          </Link>
          <span aria-hidden className="mx-2 h-5 w-px bg-line-strong" />
        </nav>
        {user ? (
          <>
            <Link href="/bookings" className="btn-ghost">
              Bookings
              {attention > 0 && (
                <span className="min-w-5 rounded-full bg-signal px-1.5 text-center text-xs leading-5 text-white" aria-label={`${attention} need attention`}>
                  {attention}
                </span>
              )}
            </Link>
            <AccountMenu name={user.name}>
              <MenuLink href="/costumes">Browse costumes</MenuLink>
              <MenuLink href="/costumes/new">Rent out a costume</MenuLink>
              <MenuLink href="/my-costumes">My costumes</MenuLink>
              <MenuLink href={`/users/${user.id}`}>My profile</MenuLink>
              <MenuLink href="/account">Account & payouts</MenuLink>
              {user.isAdmin && <MenuLink href="/admin">Admin</MenuLink>}
              <form action={logout} className="mt-1 border-t border-line pt-1">
                <button className="w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-paper hover:text-ink">Log out</button>
              </form>
            </AccountMenu>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-ghost px-3">
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
    <Link href={href} className="block px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink">
      {children}
    </Link>
  );
}
