import { auth } from "@/auth";
import { redirect } from "next/navigation";

type Authorization = {
  roles?: string[];
  emails?: string[];
  mode?: "any" | "all";
};

type HideBehindAuthProps = {
  children: React.ReactNode;
  authorization?: Authorization;
  callbackUrl?: string;
  unauthenticatedRedirectTo?: string;
  unauthorizedRedirectTo?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAuthorized(
  authorization: Authorization | undefined,
  user: { role?: string | null; email?: string | null }
): boolean {
  if (!authorization) return true;

  const mode = authorization.mode ?? "any";
  const role = user.role ?? undefined;
  const email = user.email ? normalizeEmail(user.email) : undefined;

  const roleOk =
    !authorization.roles?.length ||
    (role ? authorization.roles.includes(role) : false);

  const emailsOk =
    !authorization.emails?.length ||
    (email
      ? authorization.emails.map(normalizeEmail).includes(email)
      : false);

  if (mode === "all") return roleOk && emailsOk;
  return roleOk || emailsOk;
}

export default async function HideBehindAuth({
  children,
  authorization,
  callbackUrl = "/",
  unauthenticatedRedirectTo = "/auth/signin",
  unauthorizedRedirectTo = "/auth/unauthorized",
}: HideBehindAuthProps) {
  const session = await auth();

  if (!session?.user) {
    redirect(
      `${unauthenticatedRedirectTo}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }

  if (!isAuthorized(authorization, session.user)) {
    redirect(unauthorizedRedirectTo);
  }

  return children;
}


