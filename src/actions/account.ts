"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/errors";
import { getPayments } from "@/lib/payments";
import { ensureConnectedAccount } from "@/lib/payouts";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(60, "Keep your name under 60 characters."),
  bio: z.string().trim().max(500, "Keep your bio under 500 characters."),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/account");
  const parsed = profileSchema.safeParse({ name: formData.get("name"), bio: formData.get("bio") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function startPayoutOnboardingAction() {
  const user = await requireUser("/account");
  const accountId = await ensureConnectedAccount(user);
  redirect(await getPayments().onboardingUrl(accountId));
}
