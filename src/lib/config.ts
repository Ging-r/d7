export const APP_NAME = "Utklädnad Lund";
export const APP_TAGLINE = "Rent costumes from students near you";

export const CURRENCY = "sek";

/** Commission taken from the owner's share of the rental price. Never applied to deposits. */
export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const LUND_CENTER = { lat: 55.7047, lng: 13.191 };

/** Hours a renter has to pay after the owner accepts a request. */
export const PAYMENT_WINDOW_HOURS = 48;
/** Pickup is confirmed automatically this many days after the pickup date if the renter hasn't cancelled. */
export const AUTO_PICKUP_AFTER_DAYS = 2;
/** Owners can report damage until this many days after the return date; then the deposit is refunded automatically. */
export const DAMAGE_REPORT_DAYS = 3;
export const MAX_RENTAL_DAYS = 30;
/** How far ahead a rental can be requested. */
export const MAX_DAYS_AHEAD = 180;

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const THEMES = [
  { id: "sittning", label: "Sittning & formal", emoji: "🎩" },
  { id: "superheroes", label: "Superheroes", emoji: "🦸" },
  { id: "movies-tv", label: "Movies & TV", emoji: "🎬" },
  { id: "decades", label: "Decades (60s–00s)", emoji: "🕺" },
  { id: "halloween", label: "Halloween & horror", emoji: "🎃" },
  { id: "fantasy", label: "Fantasy & fairy tale", emoji: "🧚" },
  { id: "animals", label: "Animals", emoji: "🦁" },
  { id: "historical", label: "Historical", emoji: "🏰" },
  { id: "professions", label: "Uniforms & professions", emoji: "👩‍🚒" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "accessories", label: "Accessories & wigs", emoji: "👑" },
  { id: "other", label: "Other", emoji: "✨" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

export function themeById(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[THEMES.length - 1];
}

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "One size"] as const;
