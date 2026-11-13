import Link from "next/link";
import { Hanger, Icon, StarIcon } from "@/components/Icon";
import { STATUS_LABELS, STATUS_TONES, type BookingStatus } from "@/lib/booking-status";
import { APP_NAME, themeById, type ThemeId } from "@/lib/config";
import { photoUrl } from "@/lib/photos";
import { formatSEK } from "@/lib/pricing";

/** The wordmark: the city sits on a rental tag. */
export function Logo({ className = "text-[1.7rem]" }: { className?: string }) {
  return (
    <span className={`display inline-flex items-center gap-[0.3em] ${className}`} aria-label={APP_NAME}>
      <span aria-hidden>Utklädnad</span>
      <span aria-hidden className="tag text-[0.82em]">
        Lund
      </span>
    </span>
  );
}

const TONE_DOTS = {
  neutral: "bg-line-strong",
  warn: "bg-tag-deep",
  good: "bg-ok",
  bad: "bg-signal",
  info: "bg-ink",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = status as BookingStatus;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-1 text-xs leading-none font-semibold whitespace-nowrap">
      <span aria-hidden className={`size-2 rounded-full ${TONE_DOTS[STATUS_TONES[s] ?? "neutral"]}`} />
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex align-[-0.15em]" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={`${size === "lg" ? "size-6" : "size-4"} ${n <= rounded ? "text-ink" : "text-line-strong"}`} />
      ))}
    </span>
  );
}

export function RatingLine({ rating }: { rating?: { average: number; count: number } }) {
  if (!rating || rating.count === 0) return <span className="text-sm text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold">
      <StarIcon className="size-3.5" />
      {rating.average.toFixed(1)}
      <span className="font-normal text-muted">
        ({rating.count} {rating.count === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "size-8 text-xl",
  md: "size-12 text-3xl",
  lg: "size-20 text-5xl",
} as const;

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AVATAR_SIZES }) {
  return (
    <span aria-hidden className={`display flex shrink-0 items-center justify-center rounded-full bg-tag pt-[0.08em] text-ink ${AVATAR_SIZES[size]}`}>
      {name.slice(0, 1)}
    </span>
  );
}

/** The price on a rental tag, e.g. "150 kr / 3 days". */
export function PriceTag({ price, days, className = "" }: { price: number; days: number; className?: string }) {
  return (
    <span className={`tag whitespace-nowrap ${className}`}>
      <span className="display">{formatSEK(price)}</span>
      <span className="text-[0.5em] font-semibold tracking-wide uppercase">
        / {days} {days === 1 ? "day" : "days"}
      </span>
    </span>
  );
}

/** Paper stock per theme for listings without a photo. Formal wear gets black tie. */
const THEME_STOCK: Partial<Record<ThemeId, string>> = {
  sittning: "bg-ink text-paper",
  superheroes: "bg-stock-sky",
  "movies-tv": "bg-stock-peach",
  decades: "bg-stock-rose",
  halloween: "bg-stock-pumpkin",
  fantasy: "bg-stock-mint",
  animals: "bg-stock-kraft",
  historical: "bg-stock-stone",
  professions: "bg-stock-ice",
  sports: "bg-stock-leaf",
  accessories: "bg-stock-blush",
};

/** A listing photo, or a hanger on coloured paper when there are none. */
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
    return <img src={photoUrl(filename)} alt={alt} className={`bg-line object-cover ${className}`} loading="lazy" />;
  }
  const t = themeById(theme);
  return (
    <div
      className={`@container flex flex-col items-center justify-center gap-[7%] ${THEME_STOCK[t.id] ?? "bg-line"} ${className}`}
      role="img"
      aria-label={alt}
    >
      <Hanger className="w-[44%]" />
      <span className="display hidden px-3 text-center text-lg tracking-wide @min-[9rem]:block @min-[18rem]:text-3xl">{t.label}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
      <Hanger className="w-16 text-line-strong" />
      <p className="display mt-2 text-3xl">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-soft">{children}</div>}
      {action && (
        <Link href={action.href} className="btn-primary mt-3">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "good" | "bad"; children: React.ReactNode }) {
  const classes = {
    info: "border-ink bg-surface",
    warn: "border-tag-deep bg-tag-wash",
    good: "border-ok bg-ok-wash",
    bad: "border-signal bg-signal-wash",
  }[tone];
  return <div className={`rounded-r-md border-l-[3px] px-4 py-3 text-sm text-ink ${classes}`}>{children}</div>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted hover:text-ink">
      <Icon name="arrow-left" />
      {children}
    </Link>
  );
}

/** One line of a price breakdown. Wrap the lines in a <dl>. */
export function ReceiptRow({ label, value, muted, total }: { label: React.ReactNode; value: string; muted?: boolean; total?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${muted ? "text-muted" : ""} ${
        total ? "mt-2 border-t border-dashed border-line-strong pt-3 text-base font-semibold" : ""
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** A page section with its heading and explanation in the margin, and the content beside it on wide screens. */
export function Section({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-5 border-t-[3px] border-ink pt-5 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <h2 className="display text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-ink-soft">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** A headline figure. Wrap several in a <dl>. */
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="display mt-1.5 text-4xl whitespace-nowrap">{value}</dd>
    </div>
  );
}
