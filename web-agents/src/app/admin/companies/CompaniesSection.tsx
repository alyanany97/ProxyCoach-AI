"use client";

import { useState, useEffect } from "react";
import { CompanyCard } from "./CompanyCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompaniesSectionProps {
  companies: Array<{
    id: string;
    name: string;
    billingEmail: string | null;
    createdAt: Date;
    formattedCreatedAt?: string;
    users: Array<{ id: string; name: string | null; email: string | null }>;
  }>;
  allUsers: Array<{ id: string; name: string | null; email: string | null }>;
}

export function CompaniesSection({ companies, allUsers }: CompaniesSectionProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);

  // Auto-select first company when component mounts
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  if (companies.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-semibold">All Trainers</h2>
        <div className="rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No trainers found. Add a trainer profile above to get started.
          </p>
        </div>
      </div>
    );
  }

  const selectedCompany = selectedCompanyId
    ? companies.find((c) => c.id === selectedCompanyId)
    : null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">All Trainers</h2>

      <div className="space-y-4">
        {/* Trainer Selector Dropdown */}
        <div className="rounded-lg border border-border bg-card p-4">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Select Trainer:
          </label>
          <Select
            value={selectedCompanyId || ""}
            onValueChange={setSelectedCompanyId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a trainer..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name} ({company.users.length}{" "}
                  {company.users.length === 1 ? "client" : "clients"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Trainer Card */}
        {selectedCompany ? (
          <CompanyCard company={selectedCompany} allUsers={allUsers} />
        ) : (
          <div className="rounded-lg border border-border bg-muted p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Please select a trainer from the dropdown above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
