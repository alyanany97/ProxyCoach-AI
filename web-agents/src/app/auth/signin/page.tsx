"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <button
      className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      onClick={() => signIn("azure-ad", { callbackUrl })}
      type="button"
    >
      Sign in with Microsoft
    </button>
  );
}

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        You need to sign in to continue.
      </p>

      <Suspense fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      }>
        <SignInForm />
      </Suspense>
    </main>
  );
}
