import { auth } from "@/auth";
import { ROLES } from "@/constants/roles";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function PTPanelLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/pt");
  }

  const role = session.user.role;
  if (role !== ROLES.PT && role !== ROLES.ADMIN) {
    redirect("/");
  }

  return <>{children}</>;
}
