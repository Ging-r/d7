import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/ListingCard";
import { Avatar, RatingLine, Stars } from "@/components/ui";
import { formatMonthYear } from "@/lib/dates";
import { db } from "@/lib/db";
import { ratingsFor } from "@/lib/listings";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await db.user.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: user?.name ?? "Profile" };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      bio: true,
      createdAt: true,
      listings: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        include: { photos: { orderBy: { position: "asc" }, take: 1 } },
      },
      reviewsReceived: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { author: { select: { name: true } }, booking: { select: { ownerId: true } } },
      },
    },
  });
  if (!user) notFound();
  const rating = (await ratingsFor([user.id])).get(user.id);
  const completed = await db.booking.count({ where: { status: "COMPLETED", OR: [{ ownerId: user.id }, { renterId: user.id }] } });

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <header className="flex items-center gap-5">
          <Avatar name={user.name} size="lg" />
          <div>
            <h1 className="page-title">{user.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <RatingLine rating={rating} />
              <span>Member since {formatMonthYear(user.createdAt)}</span>
              <span>
                {completed} completed {completed === 1 ? "rental" : "rentals"}
              </span>
            </p>
          </div>
        </header>
        {user.bio && <p className="max-w-prose text-lg whitespace-pre-line text-ink-soft">{user.bio}</p>}
      </div>

      {user.listings.length > 0 && (
        <section>
          <h2 className="section-title mb-5">Costumes</h2>
          <ListingGrid listings={user.listings} />
        </section>
      )}

      <section>
        <h2 className="section-title">Reviews</h2>
        {user.reviewsReceived.length === 0 ? (
          <p className="mt-4 border-t-[3px] border-ink pt-4 text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="mt-4 max-w-3xl border-t-[3px] border-ink">
            {user.reviewsReceived.map((r) => (
              <li key={r.id} className="border-b border-line py-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-muted">
                    {r.booking.ownerId === user.id ? "As owner" : "As renter"} · {formatMonthYear(r.createdAt)}
                  </span>
                </div>
                {r.comment && <p className="mt-2 text-ink">“{r.comment}”</p>}
                <p className="mt-1 text-sm text-muted">{r.author.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
