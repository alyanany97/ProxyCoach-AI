"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An unexpected authentication error occurred. Please try again.";
  let errorTitle = "Authentication Error";

  if (error === "AccessDenied") {
    errorTitle = "Access Denied";
    errorMessage =
      "Your account hasn't been granted access to ProxyCoach AI. Contact your administrator to request an invitation.";
  } else if (error === "Configuration") {
    errorTitle = "Configuration Error";
    errorMessage =
      "There is a problem with the server configuration. Please contact support if this persists.";
  } else if (error === "Verification") {
    errorTitle = "Link Expired";
    errorMessage = "This sign-in link has expired or has already been used. Please request a new one.";
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mx-auto">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{errorTitle}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{errorMessage}</p>
        {error && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Code: {error}
          </p>
        )}
      </div>

      <Button asChild className="w-full h-11">
        <Link href="/auth/signin">Try signing in again</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: "linear-gradient(135deg, #0B1725 0%, #0f2240 50%, #0B1725 100%)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏋️</span>
          <span className="text-white font-semibold text-xl tracking-tight">ProxyCoach AI</span>
        </div>
        <p className="text-white/30 text-xs">© 2025 ProxyCoach AI. All rights reserved.</p>
      </div>

      {/* Right error panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <span className="text-2xl">🏋️</span>
          <span className="font-semibold text-lg tracking-tight">ProxyCoach AI</span>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-sm space-y-4 text-center">
              <h1 className="text-2xl font-semibold">Authentication Error</h1>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          }
        >
          <AuthErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
