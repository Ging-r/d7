"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";

export function AccountMenu({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close after navigating, so the menu doesn't linger over the new page.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex size-10 items-center justify-center rounded-full transition-shadow hover:ring-2 hover:ring-ink aria-expanded:ring-2 aria-expanded:ring-ink"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={name} size="sm" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[0_12px_32px_-8px_rgb(26_24_20/0.25)]">
          <p className="border-b border-line px-4 pt-2 pb-3 text-sm">
            <span className="eyebrow block">Signed in as</span>
            <span className="font-semibold">{name}</span>
          </p>
          {children}
        </div>
      )}
    </div>
  );
}
