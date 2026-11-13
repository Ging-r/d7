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
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-6">
      <div className="text-center">
        <h1 className="page-title">Join {APP_NAME}</h1>
        <p className="mt-1 text-sm text-stone-600">Rent costumes from students nearby, or rent out your own.</p>
      </div>
      <div className="card p-6">
        <AuthForm action={signup} mode="signup" next={next} />
      </div>
      <p className="text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
