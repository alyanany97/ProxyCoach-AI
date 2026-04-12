import { auth } from "@/auth";
import { ROLES } from "@/constants/roles";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (session.user.role !== ROLES.ADMIN) {
    redirect("/auth/unauthorized");
  }

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Back to Main App
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your application settings and users
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/clients"
          className="group rounded-lg border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-card-foreground group-hover:text-primary">
            Client Management
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite clients, manage roles and permissions
          </p>
        </Link>
        <Link
          href="/admin/trainers"
          className="group rounded-lg border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-card-foreground group-hover:text-primary">
            Trainer Management
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage trainer profiles, knowledge bases, and file uploads
          </p>
        </Link>
      </div>
    </main>
  );
}


