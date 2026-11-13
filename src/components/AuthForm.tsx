"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, submitWithoutReset } from "@/components/forms";
import type { ActionState } from "@/lib/errors";

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  mode: "login" | "signup";
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && (
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input id="name" name="name" autoComplete="name" required maxLength={60} className="input" placeholder="Shown to people you rent with" />
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
          className="input"
        />
        {mode === "signup" && <p className="hint">At least 8 characters.</p>}
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText={mode === "signup" ? "Creating account…" : "Logging in…"} className="btn-primary btn-lg">
        {mode === "signup" ? "Create account" : "Log in"}
      </SubmitButton>
    </form>
  );
}
