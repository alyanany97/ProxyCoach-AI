import { getAllCompanies } from "@/@actions/admin/companies";
import { getAllUsers } from "@/@actions/admin/roles";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CreateCompanyForm } from "../companies/CreateCompanyForm";
import { CompaniesSection } from "../companies/CompaniesSection";
import FileManagementTable from "@/components/files/FileManagementTable";

export default async function AdminTrainersPage() {
  const result = await getAllCompanies();
  const usersResult = await getAllUsers();

  if (!result.success) {
    redirect("/admin");
  }

  const { companies } = result;
  const allUsers = usersResult.success ? usersResult.users : [];

  // Format dates on server side to prevent hydration mismatches
  const companiesWithFormattedDates = companies.map((company) => ({
    ...company,
    formattedCreatedAt: new Date(company.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <main className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Back to Admin Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">Trainer Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage trainer profiles, assign clients, and control knowledge base access.
        </p>
      </div>

      {/* Create Trainer Section */}
      <div className="mb-6 rounded-lg border border-border bg-muted p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Add New Trainer
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Create a trainer profile to organise their clients and knowledge base.
        </p>
        <CreateCompanyForm />
      </div>

      {/* File Management Section */}
      <div className="mb-6 rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          File Management
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          View, download, and delete knowledge base files. Select a trainer profile to filter.
        </p>
        <FileManagementTable
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          showCompanySelector={true}
        />
      </div>

      {/* Trainers Section */}
      <CompaniesSection
        companies={companiesWithFormattedDates}
        allUsers={allUsers}
      />
    </main>
  );
}
