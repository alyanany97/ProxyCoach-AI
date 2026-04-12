import { getPTDashboard } from "@/@actions/pt";
import Link from "next/link";
import FileManagementTable from "@/components/files/FileManagementTable";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function PTFilesPage() {
  const result = await getPTDashboard();

  const company = result.success ? result.pt?.company : null;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pt" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← PT Panel
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-semibold">Knowledge Base Files</h1>
          </div>
          <SignOutButton />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {!company ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            No trainer profile assigned. Ask an admin to create one for you before managing files.
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold text-foreground">{company.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload and manage knowledge base documents for your clients. These files are used by the AI coaching agents.
              </p>
            </div>

            <FileManagementTable
              companies={[{ id: company.id, name: company.name }]}
              showCompanySelector={false}
              defaultCompanyId={company.id}
            />
          </>
        )}
      </div>
    </main>
  );
}
