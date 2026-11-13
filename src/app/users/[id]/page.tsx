import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/ListingCard";
import { RatingLine, Stars } from "@/components/ui";
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
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-800">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="page-title">{user.name}</h1>
          <p className="text-sm text-stone-500">
            Member since {formatMonthYear(user.createdAt)} · {completed} completed {completed === 1 ? "rental" : "rentals"}
          </p>
          <RatingLine rating={rating} />
        </div>
      </header>
      {user.bio && <p className="max-w-2xl whitespace-pre-line text-stone-700">{user.bio}</p>}

      {user.listings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Costumes</h2>
          <ListingGrid listings={user.listings} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
        {user.reviewsReceived.length === 0 ? (
          <p className="text-sm text-stone-500">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {user.reviewsReceived.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-stone-500">
                    {r.booking.ownerId === user.id ? "As owner" : "As renter"} · {formatMonthYear(r.createdAt)}
                  </span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-stone-700">{r.comment}</p>}
                <p className="mt-1 text-xs text-stone-500">– {r.author.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
