"use client";

import { TextInput } from "@/components/ui/text-input";
import { Select } from "@/components/ui/field-select";

export type OrganizationDetailsFormData = {
  industry: string;
  organizationType: string;
  companySize: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
};

const INDUSTRY_OPTIONS = [
  { value: "Technology & Software", label: "Technology & Software" },
  { value: "Financial Services & Fintech", label: "Financial Services & Fintech" },
  { value: "Education & EdTech", label: "Education & EdTech" },
  { value: "Healthcare & Biotech", label: "Healthcare & Biotech" },
  { value: "Media, Entertainment & Events", label: "Media, Entertainment & Events" },
  { value: "Retail, E-commerce & FMCG", label: "Retail, E-commerce & FMCG" },
  { value: "Manufacturing & Engineering", label: "Manufacturing & Engineering" },
  { value: "Non-Profit & NGO", label: "Non-Profit & NGO" },
  { value: "Government & Public Sector", label: "Government & Public Sector" },
  { value: "Consulting & Professional Services", label: "Consulting & Professional Services" },
  { value: "Other", label: "Other" },
];

const ORG_TYPE_OPTIONS = [
  { value: "Private Corporation", label: "Private Corporation" },
  { value: "Public Corporation", label: "Public Corporation" },
  { value: "Startup", label: "Startup" },
  { value: "Non-Profit Organization", label: "Non-Profit Organization" },
  { value: "Educational Institution", label: "Educational Institution" },
  { value: "Government Agency", label: "Government Agency" },
  { value: "Other", label: "Other" },
];

const COMPANY_SIZE_OPTIONS = [
  { value: "1-10 employees", label: "1-10 employees" },
  { value: "11-50 employees", label: "11-50 employees" },
  { value: "51-200 employees", label: "51-200 employees" },
  { value: "201-500 employees", label: "201-500 employees" },
  { value: "501-1,000 employees", label: "501-1,000 employees" },
  { value: "1,000+ employees", label: "1,000+ employees" },
];

interface OrganizationDetailsStepProps {
  data: OrganizationDetailsFormData;
  errors: Record<string, string>;
  onChange: (field: keyof OrganizationDetailsFormData, value: string) => void;
}

export function OrganizationDetailsStep({
  data,
  errors,
  onChange,
}: OrganizationDetailsStepProps) {
  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-heading">Organization Details & Location</h2>
        <p className="text-sm text-muted mt-1">
          Add operational details and headquarters location to complete your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Select
            label="Industry Sector"
            name="industry"
            placeholder="Select industry..."
            options={INDUSTRY_OPTIONS}
            value={data.industry}
            onChange={(v) => onChange("industry", v)}
            error={errors.industry}
          />
        </div>

        <div>
          <Select
            label="Organization Type"
            name="organizationType"
            placeholder="Select type..."
            options={ORG_TYPE_OPTIONS}
            value={data.organizationType}
            onChange={(v) => onChange("organizationType", v)}
            error={errors.organizationType}
          />
        </div>

        <div>
          <Select
            label="Company Size"
            name="companySize"
            placeholder="Select size..."
            options={COMPANY_SIZE_OPTIONS}
            value={data.companySize}
            onChange={(v) => onChange("companySize", v)}
            error={errors.companySize}
          />
        </div>

        <div>
          <TextInput
            label="Country"
            name="country"
            placeholder="e.g. United States"
            value={data.country}
            onChange={(v) => onChange("country", v)}
            error={errors.country}
            autoComplete="country-name"
          />
        </div>

        <div>
          <TextInput
            label="City"
            name="city"
            placeholder="e.g. San Francisco"
            value={data.city}
            onChange={(v) => onChange("city", v)}
            error={errors.city}
            autoComplete="address-level2"
          />
        </div>

        <div>
          <TextInput
            label="Street Address (Optional)"
            name="address"
            placeholder="e.g. 100 Market St, Suite 400"
            value={data.address}
            onChange={(v) => onChange("address", v)}
            error={errors.address}
            autoComplete="street-address"
          />
        </div>

        <div>
          <TextInput
            label="Organization Phone (Optional)"
            name="phone"
            type="tel"
            placeholder="e.g. +1 (555) 123-4567"
            value={data.phone}
            onChange={(v) => onChange("phone", v)}
            error={errors.phone}
          />
        </div>

        <div>
          <TextInput
            label="General Contact Email (Optional)"
            name="email"
            type="email"
            placeholder="e.g. info@company.com"
            value={data.email}
            onChange={(v) => onChange("email", v)}
            error={errors.email}
          />
        </div>
      </div>
    </div>
  );
}
