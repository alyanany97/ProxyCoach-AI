"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { ROLES } from "@/constants/roles";
import { cn } from "@/lib/utils";

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : undefined;
  return (first + (second ?? "")).toUpperCase();
}

export default function SidebarProfile() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Not signed in</div>
          <div className="text-xs text-muted-foreground">Sign in to sync your data</div>
        </div>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          onClick={() => signIn("azure-ad")}
          type="button"
        >
          Sign in
        </button>
      </div>
    );
  }

  const name = data.user.name ?? "Unknown";
  const email = data.user.email ?? "";
  const image = data.user.image ?? "";
  const role = (data.user as { role?: string }).role;
  const isAdmin = role === ROLES.ADMIN;
  const fallback = initials(email || name);

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "h-9 w-9 flex-shrink-0 overflow-hidden rounded-full",
          image ? "" : "bg-primary/20 text-primary border-2 border-primary/30"
        )}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
              {fallback}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{name}</div>
          {email ? (
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          ) : null}
        </div>
      </div>

      {isAdmin && (
        <Link
          href="/admin"
          className="mb-2 flex w-full items-center justify-center rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Admin Panel
        </Link>
      )}

      <button
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        type="button"
      >
        Log out
      </button>
    </div>
  );
}


