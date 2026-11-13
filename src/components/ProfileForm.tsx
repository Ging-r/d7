"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, submitWithoutReset } from "@/components/forms";
import type { ActionState } from "@/lib/errors";

export function ProfileForm({
  action,
  name,
  bio,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  bio: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="label">
          Name
        </label>
        <input id="name" name="name" defaultValue={name} required maxLength={60} className="input" />
      </div>
      <div>
        <label htmlFor="bio" className="label">
          About you
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          rows={3}
          maxLength={500}
          className="input"
          placeholder="Which nation you're in, what parties you go to, where you usually hang out…"
        />
        <p className="hint">Shown on your profile. A friendly bio gets more bookings.</p>
      </div>
      <FormMessage state={state} success="Profile saved." />
      <SubmitButton pending={pending} pendingText="Saving…" className="btn-primary self-start">
        Save profile
      </SubmitButton>
    </form>
  );
}
