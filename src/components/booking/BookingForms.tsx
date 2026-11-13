"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, SubmitButton, submitWithoutReset } from "@/components/forms";
import type { ActionState } from "@/lib/errors";
import { formatSEK } from "@/lib/pricing";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function MessageForm({ action }: { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label htmlFor="body" className="sr-only">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={2}
          maxLength={2000}
          required
          className="input resize-none"
          placeholder="Write a message…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <SubmitButton pending={pending} pendingText="…" className="btn-primary h-11 shrink-0">
          Send
        </SubmitButton>
      </div>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}

export function DamageForm({ action, deposit }: { action: FormAction; deposit: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  if (!open) {
    return (
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Report damage
      </button>
    );
  }
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
      <p className="text-sm text-stone-700">
        Claim part or all of the {formatSEK(deposit)} deposit. An admin reviews every claim and reads the chat, so attach details there too.
      </p>
      <div>
        <label htmlFor="amount" className="label">
          Amount to claim (kr)
        </label>
        <input id="amount" name="amount" type="number" min={1} max={deposit} required inputMode="numeric" className="input" />
      </div>
      <div>
        <label htmlFor="reason" className="label">
          What happened?
        </label>
        <textarea id="reason" name="reason" rows={3} minLength={10} maxLength={2000} required className="input" placeholder="The left sleeve is torn at the seam…" />
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pending={pending} className="btn-danger" pendingText="Submitting…">
          Submit claim
        </SubmitButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ReviewForm({ action, subjectName }: { action: FormAction; subjectName: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rating, setRating] = useState(0);
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-3">
      <fieldset>
        <legend className="label">How was renting with {subjectName}?</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer text-3xl leading-none">
              <input type="radio" name="rating" value={n} className="sr-only" onChange={() => setRating(n)} required />
              <span className={n <= rating ? "text-amber-500" : "text-stone-300 hover:text-amber-300"} aria-label={`${n} stars`}>
                ★
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="comment" className="label">
          Comment (optional)
        </label>
        <textarea id="comment" name="comment" rows={2} maxLength={1000} className="input" placeholder="Smooth handover, costume exactly as described." />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Posting…" className="btn-primary self-start">
        Post review
      </SubmitButton>
    </form>
  );
}

export function ResolveClaimForm({ action, claimAmount, deposit }: { action: FormAction; claimAmount: number; deposit: number }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [amount, setAmount] = useState(String(claimAmount));
  const n = Number(amount);
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="ownerAmount">
          Award to owner (kr, max {formatSEK(claimAmount)})
        </label>
        <input
          id="ownerAmount"
          name="ownerAmount"
          type="number"
          min={0}
          max={claimAmount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
          required
        />
        {Number.isFinite(n) && n >= 0 && n <= claimAmount && (
          <p className="hint">Renter gets {formatSEK(deposit - n)} of the deposit back.</p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note to both parties
        </label>
        <textarea id="note" name="note" rows={2} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Resolving…" className="btn-primary self-start">
        Resolve claim
      </SubmitButton>
    </form>
  );
}

/** Re-fetches the server-rendered page periodically so new chat messages show up. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** Fires once after mount, so reading the page clears the unread badge. */
export function MarkRead({ action }: { action: () => Promise<void> }) {
  useEffect(() => {
    void action();
  }, [action]);
  return null;
}
