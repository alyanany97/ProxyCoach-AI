import { getPTDashboard } from "@/@actions/pt";
import Link from "next/link";
import { Users, FileText, Settings } from "lucide-react";
import { PTProfileForm } from "./PTProfileForm";

export default async function PTPanelPage() {
  const result = await getPTDashboard();

  const company = result.success ? result.pt?.company : null;
  const clientCount = company?._count?.users ?? 0;
  const fileCount = company?._count?.uploadedFiles ?? 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to App
            </Link>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏋️</span>
              <h1 className="text-lg font-semibold">PT Panel</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* No company warning */}
        {!company && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-foreground">
            <p className="font-medium">No trainer profile assigned</p>
            <p className="mt-1 text-muted-foreground">
              Ask an admin to create a trainer profile and assign it to your account before you can manage clients.
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/pt/clients"
            className="group rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Clients</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{clientCount}</p>
                <p className="mt-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                  Manage clients →
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Link>

          <Link
            href="/pt/files"
            className="group rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Knowledge Base Files</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{fileCount}</p>
                <p className="mt-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                  Manage files →
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Link>
        </div>

        {/* Profile / company info */}
        {company && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted px-6 py-4">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">My Trainer Profile</h2>
            </div>
            <div className="p-6">
              <PTProfileForm
                companyId={company.id}
                currentName={company.name}
                currentBillingEmail={company.billingEmail}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
