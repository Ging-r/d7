import Link from "next/link";
import { STATUS_LABELS, STATUS_TONES, type BookingStatus } from "@/lib/booking-status";
import { themeById } from "@/lib/config";
import { photoUrl } from "@/lib/photos";

const TONE_CLASSES = {
  neutral: "bg-stone-100 text-stone-700",
  warn: "bg-amber-100 text-amber-900",
  good: "bg-emerald-100 text-emerald-800",
  bad: "bg-red-100 text-red-800",
  info: "bg-brand-100 text-brand-800",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = status as BookingStatus;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[STATUS_TONES[s] ?? "neutral"]}`}>
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const rounded = Math.round(rating);
  return (
    <span className={`text-amber-500 ${size === "lg" ? "text-xl" : "text-sm"}`} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {"★".repeat(rounded)}
      <span className="text-stone-300">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

export function RatingLine({ rating }: { rating?: { average: number; count: number } }) {
  if (!rating || rating.count === 0) return <span className="text-sm text-stone-500">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-stone-600">
      <Stars rating={rating.average} /> {rating.average.toFixed(1)} ({rating.count})
    </span>
  );
}

/** A listing photo, or a themed placeholder tile when there are none. */
export function CostumeImage({
  filename,
  theme,
  alt,
  className = "",
}: {
  filename?: string | null;
  theme: string;
  alt: string;
  className?: string;
}) {
  if (filename) {
    // eslint-disable-next-line @next/next/no-img-element -- user uploads are served by our own route
    return <img src={photoUrl(filename)} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-amber-100 ${className}`} role="img" aria-label={alt}>
      <span className="text-5xl">{themeById(theme).emoji}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-stone-600">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "good" | "bad"; children: React.ReactNode }) {
  const classes = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    bad: "border-red-200 bg-red-50 text-red-900",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>;
}
