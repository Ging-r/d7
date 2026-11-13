"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AccountMenu({ initial, children }: { initial: string; children: React.ReactNode }) {
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
      <button type="button" className="btn-ghost px-2" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">{initial}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">{children}</div>
      )}
    </div>
  );
}
