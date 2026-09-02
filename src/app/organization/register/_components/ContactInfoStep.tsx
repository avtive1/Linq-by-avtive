"use client";

import { TextInput } from "@/components/ui/text-input";

export type ContactFormData = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactDesignation: string;
  contactLinkedin: string;
};

interface ContactInfoStepProps {
  data: ContactFormData;
  errors: Record<string, string>;
  onChange: (field: keyof ContactFormData, value: string) => void;
}

export function ContactInfoStep({ data, errors, onChange }: ContactInfoStepProps) {
  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-heading">Primary Contact Person</h2>
        <p className="text-sm text-muted mt-1">
          Provide the details of the authorized representative registering this organization.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextInput
            label="Full Name"
            name="contactName"
            required
            placeholder="e.g. Jane Doe"
            value={data.contactName}
            onChange={(v) => onChange("contactName", v)}
            error={errors.contactName}
            autoComplete="name"
          />
        </div>

        <div>
          <TextInput
            label="Work Email Address"
            name="contactEmail"
            type="email"
            required
            placeholder="jane@company.com"
            value={data.contactEmail}
            onChange={(v) => onChange("contactEmail", v)}
            error={errors.contactEmail}
            autoComplete="email"
          />
        </div>

        <div>
          <TextInput
            label="Phone Number"
            name="contactPhone"
            type="tel"
            required
            placeholder="+1 (555) 012-3456"
            value={data.contactPhone}
            onChange={(v) => onChange("contactPhone", v)}
            error={errors.contactPhone}
            autoComplete="tel"
          />
        </div>

        <div>
          <TextInput
            label="Designation / Job Title"
            name="contactDesignation"
            required
            placeholder="e.g. Chief Marketing Officer"
            value={data.contactDesignation}
            onChange={(v) => onChange("contactDesignation", v)}
            error={errors.contactDesignation}
            autoComplete="organization-title"
          />
        </div>

        <div>
          <TextInput
            label="LinkedIn Profile (Optional)"
            name="contactLinkedin"
            type="url"
            placeholder="https://linkedin.com/in/username"
            value={data.contactLinkedin}
            onChange={(v) => onChange("contactLinkedin", v)}
            error={errors.contactLinkedin}
          />
        </div>
      </div>
    </div>
  );
}
