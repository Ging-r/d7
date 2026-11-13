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
    <div className="mx-auto flex max-w-sm flex-col gap-8 py-6 sm:py-12">
      <h1 className="page-title">Log in</h1>
      <AuthForm action={login} mode="login" next={next} />
      <p className="border-t border-line pt-5 text-sm text-ink-soft">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="link text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
