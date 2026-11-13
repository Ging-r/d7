// Demo data: a few students in Lund with costumes, plus one finished rental
// with reviews. Every demo account uses the password "password123".
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, todayISO } from "../src/lib/dates";
import { fuzzLocation } from "../src/lib/geo";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });
// Without Stripe keys the app simulates payments, so demo owners can accept requests right away.
const mockPayouts = !process.env.STRIPE_SECRET_KEY;

const PLACES = {
  "Lund C": { lat: 55.7056, lng: 13.1868 },
  Delphi: { lat: 55.7193, lng: 13.2112 },
  Sparta: { lat: 55.7146, lng: 13.2149 },
  LTH: { lat: 55.7116, lng: 13.2093 },
  Klostergården: { lat: 55.6938, lng: 13.1852 },
  Lundagård: { lat: 55.7052, lng: 13.1937 },
  "Norra Fäladen": { lat: 55.7238, lng: 13.2003 },
  Vildanden: { lat: 55.7153, lng: 13.2028 },
  Parentesen: { lat: 55.7104, lng: 13.2071 },
  Clemenstorget: { lat: 55.7037, lng: 13.1892 },
  Kämnärsvägen: { lat: 55.7172, lng: 13.2196 },
} as const;

type Place = keyof typeof PLACES;

async function main() {
  if ((await db.user.count()) > 0) {
    console.log("Database already has data; skipping seed. Run `npm run db:reset` to start over.");
    return;
  }
  const passwordHash = await hashPassword("password123");
  const user = (name: string, email: string, bio: string, extra: { isAdmin?: boolean; owner?: boolean } = {}) =>
    db.user.create({
      data: {
        name,
        email,
        bio,
        passwordHash,
        isAdmin: extra.isAdmin ?? false,
        stripeAccountId: extra.owner && mockPayouts ? `mock_acct_${email.split("@")[0]}` : null,
        payoutsEnabled: Boolean(extra.owner && mockPayouts),
      },
    });

  await user("Admin", "admin@example.com", "Runs the platform.", { isAdmin: true });
  const elsa = await user("Elsa", "elsa@example.com", "Third-year law student at Lunds nation. My wardrobe is 50% costumes.", { owner: true });
  const oskar = await user("Oskar", "oskar@example.com", "LTH engineer, sittning enthusiast. Happy to meet near E-huset.", { owner: true });
  const amira = await user("Amira", "amira@example.com", "Master's student, living in Delphi. Ask me about fit!", { owner: true });
  const lukas = await user("Lukas", "lukas@example.com", "Exchange student from Germany, here for a year. Travelled light!");

  const listing = (
    ownerId: string,
    place: Place,
    data: { title: string; description: string; theme: string; size: string; price: number; includedDays?: number; extraDayPrice?: number; deposit: number; value?: number },
  ) => {
    const exact = PLACES[place];
    const pub = fuzzLocation(exact);
    return db.listing.create({
      data: { ...data, ownerId, areaLabel: place, lat: exact.lat, lng: exact.lng, publicLat: pub.lat, publicLng: pub.lng },
    });
  };

  const tux = await listing(oskar.id, "LTH", {
    title: "Classic black tuxedo with bow tie",
    description: "Single-breasted tuxedo, trousers, white shirt and a black bow tie. Perfect for a gasque or a formal sittning. Fits like a normal L (I'm 184 cm).",
    theme: "sittning",
    size: "L",
    price: 200,
    extraDayPrice: 50,
    deposit: 500,
    value: 2500,
  });
  await listing(elsa.id, "Delphi", {
    title: "Pirate captain – full outfit",
    description: "Long red coat, tricorn hat, belt, eye patch and a plastic sword. Has survived several pub crawls and still looks great.",
    theme: "fantasy",
    size: "M",
    price: 150,
    extraDayPrice: 40,
    deposit: 300,
    value: 900,
  });
  await listing(amira.id, "Sparta", {
    title: "70s disco jumpsuit with flares",
    description: "Shiny gold jumpsuit with wide flares. Stretchy fabric, fits S–M. Platform shoes not included.",
    theme: "decades",
    size: "S",
    price: 120,
    includedDays: 2,
    deposit: 200,
  });
  await listing(oskar.id, "Vildanden", {
    title: "Caped superhero suit with mask",
    description: "Blue bodysuit with a red cape and an eye mask. Generic enough to be any hero you like.",
    theme: "superheroes",
    size: "M",
    price: 130,
    deposit: 200,
  });
  await listing(elsa.id, "Klostergården", {
    title: "Cosy lion onesie",
    description: "Fluffy lion onesie with a mane hood. Warm enough for an outdoor party in November.",
    theme: "animals",
    size: "One size",
    price: 80,
    deposit: 100,
  });
  await listing(amira.id, "Lundagård", {
    title: "Medieval knight tunic & knitted chainmail",
    description: "Tunic with a cross emblem, a knitted chainmail hood and a belt. Great for a medieval-themed sittning.",
    theme: "historical",
    size: "L",
    price: 180,
    extraDayPrice: 40,
    deposit: 400,
  });
  await listing(elsa.id, "Norra Fäladen", {
    title: "Witch dress with hat and broom",
    description: "Black lace dress, pointy hat and a small broom. Classic Halloween.",
    theme: "halloween",
    size: "M",
    price: 100,
    deposit: 150,
  });
  await listing(oskar.id, "Parentesen", {
    title: "Firefighter uniform",
    description: "Jacket and trousers with reflective stripes, plus a helmet. Roomy fit.",
    theme: "professions",
    size: "XL",
    price: 120,
    deposit: 200,
  });
  await listing(amira.id, "Kämnärsvägen", {
    title: "Fairy wings & tutu set",
    description: "Glittery wings, a tutu and a wand. Small fit.",
    theme: "fantasy",
    size: "XS",
    price: 70,
    deposit: 100,
  });
  await listing(elsa.id, "Clemenstorget", {
    title: "80s shell suit tracksuit",
    description: "Neon purple and teal shell suit. Loud, rustly and perfect for an 80s party.",
    theme: "decades",
    size: "M",
    price: 90,
    deposit: 100,
  });
  await listing(oskar.id, "Lund C", {
    title: "Afro wig + star sunglasses",
    description: "Big rainbow afro wig and star-shaped sunglasses. Instant costume upgrade.",
    theme: "accessories",
    size: "One size",
    price: 50,
    deposit: 50,
  });
  await listing(amira.id, "Delphi", {
    title: "Deep blue ball gown",
    description: "Floor-length satin gown with a lace-up back, so it adjusts a size up or down. Dry-cleaned after every rental.",
    theme: "sittning",
    size: "S",
    price: 250,
    extraDayPrice: 60,
    deposit: 600,
    value: 3000,
  });

  // A finished rental so profiles and listings have reviews to show.
  const start = addDays(todayISO(), -20);
  const done = await db.booking.create({
    data: {
      listingId: tux.id,
      renterId: lukas.id,
      ownerId: oskar.id,
      startDate: start,
      endDate: addDays(start, 2),
      days: 2,
      rentalAmount: 200,
      depositAmount: 500,
      platformFee: 20,
      ownerPayout: 180,
      status: "COMPLETED",
      acceptedAt: new Date(Date.now() - 22 * 864e5),
      paidAt: new Date(Date.now() - 21 * 864e5),
      pickedUpAt: new Date(Date.now() - 20 * 864e5),
      completedAt: new Date(Date.now() - 18 * 864e5),
      // Marked as settled so the app never tries to move money for demo data.
      paymentIntentId: "seed_pi",
      chargeId: "seed_ch",
      payoutTransferId: "seed_tr",
      depositRefundId: "seed_re",
      messages: {
        create: [
          { senderId: lukas.id, body: "Hi Oskar! Could I borrow the tux for the Smålands gasque?", createdAt: new Date(Date.now() - 23 * 864e5) },
          { senderId: oskar.id, body: "Sure! Meet outside E-huset at 17?", createdAt: new Date(Date.now() - 22 * 864e5) },
        ],
      },
    },
  });
  await db.review.createMany({
    data: [
      { bookingId: done.id, authorId: lukas.id, subjectId: oskar.id, rating: 5, comment: "Fit perfectly and Oskar was super flexible with the time." },
      { bookingId: done.id, authorId: oskar.id, subjectId: lukas.id, rating: 5, comment: "Returned clean and on time. Welcome back anytime!" },
    ],
  });

  console.log("Seeded demo data. Log in as elsa@example.com, oskar@example.com, amira@example.com, lukas@example.com or admin@example.com (password: password123).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
