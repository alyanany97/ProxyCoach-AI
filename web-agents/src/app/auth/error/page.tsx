"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An authentication error occurred.";
  
  if (error === "AccessDenied") {
    errorMessage = "Access denied. Your account may not be assigned to this application, or you may not have permission to sign in.";
  } else if (error === "Configuration") {
    errorMessage = "There is a problem with the server configuration.";
  } else if (error === "Verification") {
    errorMessage = "The verification token has expired or has already been used.";
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Authentication Error</h1>
      <p className="text-sm text-muted-foreground">{errorMessage}</p>
      {error && (
        <p className="text-xs text-muted-foreground">Error code: {error}</p>
      )}
      <div className="mt-4">
        <Link
          href="/auth/signin"
          className="text-sm text-primary hover:text-primary/80 underline"
        >
          Try signing in again
        </Link>
      </div>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <Suspense fallback={
        <>
          <h1 className="text-2xl font-semibold">Authentication Error</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </>
      }>
        <AuthErrorContent />
      </Suspense>
    </main>
  );
}
