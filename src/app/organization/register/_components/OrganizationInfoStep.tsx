"use client";

import { TextInput } from "@/components/ui/text-input";
import { TextArea } from "@/components/ui/text-area";
import { FilePicker } from "@/components/ui/file-picker";

export type SocialLinksData = {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  other?: string;
};

export type OrganizationFormData = {
  organizationName: string;
  organizationWebsite: string;
  organizationDescription: string;
  organizationLogo: string;
  socialLinks: SocialLinksData;
};

interface OrganizationInfoStepProps {
  data: OrganizationFormData;
  errors: Record<string, string>;
  onChange: (field: keyof OrganizationFormData, value: unknown) => void;
  onSocialChange: (platform: keyof SocialLinksData, value: string) => void;
  onLogoError?: (msg: string) => void;
}

export function OrganizationInfoStep({
  data,
  errors,
  onChange,
  onSocialChange,
  onLogoError,
}: OrganizationInfoStepProps) {
  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-heading">Organization Information</h2>
        <p className="text-sm text-muted mt-1">
          Provide your brand details, official logo, and online presence.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <TextInput
            label="Organization / Company Name"
            name="organizationName"
            required
            placeholder="e.g. Acme Innovations Corp."
            value={data.organizationName}
            onChange={(v) => onChange("organizationName", v)}
            error={errors.organizationName}
            autoComplete="organization"
          />
        </div>

        <div>
          <TextInput
            label="Official Website"
            name="organizationWebsite"
            type="url"
            placeholder="https://www.company.com"
            value={data.organizationWebsite}
            onChange={(v) => onChange("organizationWebsite", v)}
            error={errors.organizationWebsite}
          />
        </div>

        <div>
          <TextArea
            label="Organization Description"
            name="organizationDescription"
            placeholder="Brief overview of what your company or organization does..."
            value={data.organizationDescription}
            onChange={(v) => onChange("organizationDescription", v)}
            error={errors.organizationDescription}
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="pt-1">
          <FilePicker
            label="Organization Logo"
            required
            value={data.organizationLogo}
            onChange={(base64) => onChange("organizationLogo", base64)}
            onError={onLogoError}
            error={errors.organizationLogo}
            cropTitle="Adjust Organization Logo"
            cropSubtitle="Crop your official logo for clean display across badges and portals."
            cropApplyLabel="Save Logo"
            freeFormCrop={false}
            cropAspect={1}
          />
          <p className="text-xs text-muted mt-1">
            Accepts PNG, JPEG, or WebP (square aspect ratio recommended, max 20MB).
          </p>
        </div>

        <div className="border-t border-hairline-soft pt-4 mt-2">
          <h3 className="text-sm font-semibold text-heading mb-3">Social Media Presence (Optional)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <TextInput
                label="LinkedIn Company Page"
                name="social_linkedin"
                type="url"
                placeholder="https://linkedin.com/company/acme"
                value={data.socialLinks.linkedin || ""}
                onChange={(v) => onSocialChange("linkedin", v)}
                error={errors["socialLinks.linkedin"]}
              />
            </div>
            <div>
              <TextInput
                label="X / Twitter"
                name="social_twitter"
                type="url"
                placeholder="https://x.com/acme"
                value={data.socialLinks.twitter || ""}
                onChange={(v) => onSocialChange("twitter", v)}
                error={errors["socialLinks.twitter"]}
              />
            </div>
            <div>
              <TextInput
                label="Facebook"
                name="social_facebook"
                type="url"
                placeholder="https://facebook.com/acme"
                value={data.socialLinks.facebook || ""}
                onChange={(v) => onSocialChange("facebook", v)}
                error={errors["socialLinks.facebook"]}
              />
            </div>
            <div>
              <TextInput
                label="Instagram"
                name="social_instagram"
                type="url"
                placeholder="https://instagram.com/acme"
                value={data.socialLinks.instagram || ""}
                onChange={(v) => onSocialChange("instagram", v)}
                error={errors["socialLinks.instagram"]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
