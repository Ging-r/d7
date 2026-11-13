"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, submitWithoutReset } from "@/components/forms";
import { ReceiptRow } from "@/components/ui";
import { addDays, daysBetween, formatDateRange, rangesOverlap } from "@/lib/dates";
import type { ActionState } from "@/lib/errors";
import { formatSEK, quote, type PricedListing } from "@/lib/pricing";

export function BookingRequestForm({
  action,
  listing,
  maxDays,
  blocked,
  today,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  listing: PricedListing;
  maxDays: number;
  blocked: { startDate: string; endDate: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const days = start && end ? daysBetween(start, end) : 0;
  const conflict = days > 0 && blocked.some((b) => rangesOverlap(start, end, b.startDate, b.endDate));
  const tooLong = days > maxDays;
  // The renter's price doesn't depend on the platform fee, which comes out of the owner's share.
  const q = days > 0 && !tooLong ? quote(listing, days, 0) : null;

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startDate" className="label">
            Pickup
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="input"
            min={today}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value && (!end || end <= e.target.value)) setEnd(addDays(e.target.value, Math.min(listing.includedDays, 2)));
            }}
            required
          />
        </div>
        <div>
          <label htmlFor="endDate" className="label">
            Return
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="input"
            min={start ? addDays(start, 1) : addDays(today, 1)}
            max={start ? addDays(start, maxDays) : undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
      </div>

      {conflict && <p className="rounded-md bg-tag-wash px-3 py-2 text-sm font-medium">The costume is already booked for some of these days.</p>}
      {tooLong && (
        <p className="rounded-md bg-tag-wash px-3 py-2 text-sm font-medium">
          This costume can be rented for at most {maxDays} {maxDays === 1 ? "day" : "days"}.
        </p>
      )}

      {q && !conflict && (
        <dl className="flex flex-col gap-1.5 rounded-md bg-paper p-4 text-sm">
          <ReceiptRow
            label={
              <>
                Rental, {q.days} {q.days === 1 ? "day" : "days"}
                {q.extraDays > 0 && <span className="text-muted"> (incl. {q.extraDays} extra)</span>}
              </>
            }
            value={formatSEK(q.rentalAmount)}
          />
          {q.depositAmount > 0 && <ReceiptRow label="Refundable deposit" value={formatSEK(q.depositAmount)} muted />}
          <ReceiptRow label="Total" value={formatSEK(q.total)} total />
        </dl>
      )}

      <div>
        <label htmlFor="message" className="label">
          Message to the owner
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={2000}
          className="input"
          placeholder="Hi! I'd love to borrow this for a sittning on Saturday. Does it fit someone who is 180 cm?"
        />
      </div>

      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Sending request…" className="btn-primary btn-lg w-full">
        Request to rent
      </SubmitButton>
      <p className="text-center text-xs text-muted">You won&apos;t pay anything until the owner accepts.</p>

      {blocked.length > 0 && (
        <div className="border-t border-line pt-4 text-sm text-ink-soft">
          <p className="eyebrow mb-1">Already booked</p>
          <ul>
            {blocked.map((b) => (
              <li key={`${b.startDate}-${b.endDate}`}>{formatDateRange(b.startDate, b.endDate)}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
