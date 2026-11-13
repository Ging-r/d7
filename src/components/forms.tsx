"use client";

import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/errors";

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  /** Pass when the form is submitted with `submitWithoutReset`, which useFormStatus can't see. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function FormMessage({ state, success }: { state: ActionState; success?: string }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-md bg-signal-wash px-3 py-2 text-sm font-medium text-signal">
        {state.error}
      </p>
    );
  }
  if (state?.ok && success) {
    return (
      <p role="status" className="rounded-md bg-ok-wash px-3 py-2 text-sm font-medium text-ok">
        {success}
      </p>
    );
  }
  return null;
}

/**
 * onSubmit handler that runs an action without React's automatic form reset,
 * so a validation error doesn't wipe what the user typed.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void, prepare?: (formData: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    prepare?.(formData);
    startTransition(() => dispatch(formData));
  };
}

/** A one-click server action (accept, cancel, …) with an optional confirmation and inline errors. */
export function ActionButton({
  action,
  children,
  pendingText,
  confirm,
  className = "btn-primary",
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  pendingText?: string;
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(() => action(), undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <button type="submit" disabled={pending} className={className}>
        {pending ? (pendingText ?? "Working…") : children}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
