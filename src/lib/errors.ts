/** An expected failure whose message is safe to show to the user. */
export class UserError extends Error {
  override name = "UserError";
}

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** Runs a server action body, turning UserErrors into form state. Other errors propagate. */
export async function toActionState(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
