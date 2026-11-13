"use client";

import { Children, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/** A clothes rail to flick through: each child hangs from it on its own hook. */
export function Rail({ heading, action, children }: { heading: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-5 flex items-end gap-4">
        <div className="mr-auto">{heading}</div>
        {action}
        <div className="hidden gap-1.5 sm:flex">
          <button type="button" className="btn-secondary size-10 p-0" onClick={() => scrollBy(-1)} disabled={edge.start} aria-label="Scroll back">
            <Icon name="chevron-left" className="size-5" />
          </button>
          <button type="button" className="btn-secondary size-10 p-0" onClick={() => scrollBy(1)} disabled={edge.end} aria-label="Scroll forward">
            <Icon name="chevron-right" className="size-5" />
          </button>
        </div>
      </div>
      <div ref={scroller} className="-mx-4 snap-x scroll-px-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <div className="relative w-max min-w-full">
          <div aria-hidden className="absolute inset-x-0 top-[8.5px] h-[3px] rounded-full bg-ink" />
          <ul className="flex gap-4">
            {Children.map(children, (child) => (
              <li className="relative w-[38vw] shrink-0 snap-start pt-[34px] sm:w-52">
                <svg viewBox="0 0 20 34" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="absolute top-0 left-1/2 h-[34px] w-5 -translate-x-1/2">
                  <path d="M10 34V16a6 6 0 1 0-6-6" />
                </svg>
                {child}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
