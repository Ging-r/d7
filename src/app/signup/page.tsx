import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8 py-6 sm:py-12">
      <div>
        <h1 className="page-title">Join {APP_NAME}</h1>
        <p className="mt-3 text-ink-soft">Rent costumes from students nearby, or rent out your own.</p>
      </div>
      <AuthForm action={signup} mode="signup" next={next} />
      <p className="border-t border-line pt-5 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="link text-ink">
          Log in
        </Link>
      </p>
    </div>
  );
}
