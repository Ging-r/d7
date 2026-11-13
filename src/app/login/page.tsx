import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/actions/auth";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-6">
      <h1 className="page-title text-center">Welcome back</h1>
      <div className="card p-6">
        <AuthForm action={login} mode="login" next={next} />
      </div>
      <p className="text-center text-sm text-stone-600">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
