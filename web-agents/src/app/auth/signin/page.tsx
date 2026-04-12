"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, Dumbbell, ArrowLeft, ChevronRight } from "lucide-react";

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

function BrandPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
      style={{ background: "linear-gradient(135deg, #0B1725 0%, #0f2240 50%, #0B1725 100%)" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏋️</span>
        <span className="text-white font-semibold text-xl tracking-tight">ProxyCoach AI</span>
      </div>
      <div className="space-y-6">
        <p className="text-white/90 text-2xl font-light leading-relaxed">
          "Your AI-powered coaching and agent workspace."
        </p>
        <div className="flex flex-col gap-3">
          {[
            "Intelligent coaching conversations",
            "Document-aware AI agents",
            "Personalised training & nutrition guidance",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span className="text-white/70 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-white/30 text-xs">© 2025 ProxyCoach AI. All rights reserved.</p>
    </div>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") as "client" | "trainer" | null;
  const callbackUrl = searchParams.get("callbackUrl");

  // Role selection screen
  if (!type) {
    return (
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to ProxyCoach AI</h1>
          <p className="text-sm text-muted-foreground">
            How are you using ProxyCoach AI?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/auth/signin?type=client"
            className={cn(
              "group flex items-center gap-4 rounded-xl border border-border bg-card p-5",
              "hover:border-primary/50 hover:bg-accent hover:shadow-md transition-all"
            )}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">I&apos;m a Client</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Access your coaching dashboard and AI agents
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </Link>

          <Link
            href="/auth/signin?type=trainer"
            className={cn(
              "group flex items-center gap-4 rounded-xl border border-border bg-card p-5",
              "hover:border-primary/50 hover:bg-accent hover:shadow-md transition-all"
            )}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">I&apos;m a Personal Trainer</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage clients, files, and training programs
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    );
  }

  // Role-specific sign-in screen
  const isTrainer = type === "trainer";
  const defaultCallback = isTrainer ? "/pt" : "/";
  const resolvedCallback = callbackUrl ?? defaultCallback;

  return (
    <div className="w-full max-w-sm space-y-8">
      <Link
        href="/auth/signin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            isTrainer ? "bg-primary/10" : "bg-blue-500/10"
          )}>
            {isTrainer
              ? <Dumbbell className="h-5 w-5 text-primary" />
              : <Users className="h-5 w-5 text-blue-500" />
            }
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isTrainer ? "Trainer Sign In" : "Client Sign In"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {isTrainer
            ? "Sign in with your YMCA Microsoft account to access your trainer dashboard."
            : "Sign in with your Microsoft account to access your coaching workspace."}
        </p>
      </div>

      <div className="space-y-4">
        <Button
          className="w-full gap-3 h-11 text-sm font-medium"
          onClick={() => signIn("azure-ad", { callbackUrl: resolvedCallback })}
          type="button"
        >
          <MicrosoftIcon />
          Continue with Microsoft
        </Button>

        <div className={cn(
          "rounded-lg border px-4 py-3 text-xs text-muted-foreground",
          isTrainer
            ? "border-primary/20 bg-primary/5"
            : "border-border bg-muted/50"
        )}>
          {isTrainer ? (
            <>
              <span className="font-medium text-foreground">Trainers only:</span> Requires a{" "}
              <span className="font-mono text-primary">@ytr.ymca.ca</span> Microsoft account.
              Contact your administrator if you need access.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Invitation required:</span> You need an
              invitation from your trainer to access ProxyCoach AI.
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      <BrandPanel />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <span className="text-2xl">🏋️</span>
          <span className="font-semibold text-lg tracking-tight">ProxyCoach AI</span>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-sm space-y-4">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="h-11 w-full animate-pulse rounded bg-muted" />
            </div>
          }
        >
          <SignInContent />
        </Suspense>
      </div>
    </div>
  );
}
