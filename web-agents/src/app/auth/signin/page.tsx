"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

function MicrosoftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <Button
      className="w-full gap-3 h-11 text-sm font-medium"
      onClick={() => signIn("azure-ad", { callbackUrl })}
      type="button"
    >
      <MicrosoftIcon />
      Continue with Microsoft
    </Button>
  );
}

export default function SignInPage() {
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

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-white/90 text-2xl font-light leading-relaxed">
              "Your AI-powered coaching and agent workspace."
            </p>
          </blockquote>
          <div className="flex flex-col gap-3">
            {[
              "Intelligent coaching conversations",
              "Document-aware AI agents",
              "Multi-tenant team management",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span className="text-white/70 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">© 2025 ProxyCoach AI. All rights reserved.</p>
      </div>

      {/* Right sign-in panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <span className="text-2xl">🏋️</span>
          <span className="font-semibold text-lg tracking-tight">ProxyCoach AI</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your ProxyCoach AI workspace
            </p>
          </div>

          <div className="space-y-4">
            <Suspense
              fallback={
                <Button className="w-full h-11" disabled>
                  Loading...
                </Button>
              }
            >
              <SignInForm />
            </Suspense>

            <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
