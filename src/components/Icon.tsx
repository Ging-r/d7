const PATHS = {
  "arrow-left": <path d="M19 12H5m6-6-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  locate: <path d="M12 2v3m0 14v3M2 12h3m14 0h3M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  pin: <path d="M12 21.5s7-6.2 7-11.5a7 7 0 1 0-14 0c0 5.3 7 11.5 7 11.5Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  plus: <path d="M12 5v14m-7-7h14" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4" />,
  sliders: <path d="M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-6 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
} as const;

export type IconName = keyof typeof PATHS;

/** Line icons drawn on a 24px grid. They inherit the text colour and are hidden from screen readers. */
export function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

export function StarIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={`shrink-0 ${className}`}>
      <path d="m12 2.5 2.9 6.1 6.6.9-4.8 4.6 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9L12 2.5Z" />
    </svg>
  );
}

/** A wire hanger: the stand-in for a costume that has no photo. */
export function Hanger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 76" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M52 12a8 8 0 1 1 12.5 6.6C61.5 20.7 60 22.5 60 25.5V30" />
      <path d="M60 30 110.5 59c5 2.9 3 10.5-2.8 10.5H12.3C6.5 69.5 4.5 61.9 9.5 59L60 30Z" />
    </svg>
  );
}
