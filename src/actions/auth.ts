"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, safeNext } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionState } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(60, "Keep your name under 60 characters."),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});

export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "There's already an account with this email. Log in instead." };
  }
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
