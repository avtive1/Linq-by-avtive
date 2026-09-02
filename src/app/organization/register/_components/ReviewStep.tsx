"use client";

import { Edit3, ExternalLink, Building2, User, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ContactFormData } from "./ContactInfoStep";
import type { OrganizationFormData } from "./OrganizationInfoStep";
import type { OrganizationDetailsFormData } from "./OrganizationDetailsStep";
import type { StepNumber } from "./RegistrationProgressBar";

interface ReviewStepProps {
  contactData: ContactFormData;
  orgData: OrganizationFormData;
  detailsData: OrganizationDetailsFormData;
  onEditStep: (step: StepNumber) => void;
}

export function ReviewStep({
  contactData,
  orgData,
  detailsData,
  onEditStep,
}: ReviewStepProps) {
  return (
    <div className="flex flex-col gap-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-semibold text-heading">Review & Confirm</h2>
        <p className="text-sm text-muted mt-1">
          Please review your submitted information carefully before sending.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Contact Person Summary */}
        <Card className="p-5 border-hairline-soft bg-white shadow-none">
          <div className="flex items-center justify-between border-b border-hairline-soft pb-3 mb-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-primary" />
              <h3 className="text-base font-semibold text-heading">Primary Contact Person</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(1)}
              className="h-8 gap-1.5 text-xs text-primary font-medium hover:bg-primary/5"
            >
              <Edit3 size={14} />
              Edit
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Full Name</span>
              <span className="font-semibold text-heading">{contactData.contactName || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Work Email</span>
              <span className="font-semibold text-heading">{contactData.contactEmail || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Phone Number</span>
              <span className="font-medium text-ink">{contactData.contactPhone || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Designation</span>
              <span className="font-medium text-ink">{contactData.contactDesignation || "—"}</span>
            </div>
            {contactData.contactLinkedin && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">LinkedIn Profile</span>
                <a
                  href={contactData.contactLinkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs break-all"
                >
                  {contactData.contactLinkedin}
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </Card>

        {/* Organization Information Summary */}
        <Card className="p-5 border-hairline-soft bg-white shadow-none">
          <div className="flex items-center justify-between border-b border-hairline-soft pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-primary" />
              <h3 className="text-base font-semibold text-heading">Organization Information</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(2)}
              className="h-8 gap-1.5 text-xs text-primary font-medium hover:bg-primary/5"
            >
              <Edit3 size={14} />
              Edit
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              {orgData.organizationLogo ? (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface p-1 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={orgData.organizationLogo}
                    alt={orgData.organizationName || "Logo"}
                    className="h-full w-full object-contain rounded-md"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 shrink-0 flex items-center justify-center rounded-lg border border-hairline bg-surface text-muted">
                  <Building2 size={24} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-heading">{orgData.organizationName || "—"}</h4>
                {orgData.organizationWebsite && (
                  <a
                    href={orgData.organizationWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs mt-0.5"
                  >
                    <Globe size={12} />
                    {orgData.organizationWebsite}
                  </a>
                )}
                {orgData.organizationDescription && (
                  <p className="text-xs text-muted mt-2 line-clamp-3 leading-relaxed">
                    {orgData.organizationDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Social Links */}
            {Object.values(orgData.socialLinks).some(Boolean) && (
              <div className="border-t border-hairline-soft pt-3">
                <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">Social Channels</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {orgData.socialLinks.linkedin && (
                    <a
                      href={orgData.socialLinks.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-surface px-2.5 py-1 text-ink hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink size={10} />
                    </a>
                  )}
                  {orgData.socialLinks.twitter && (
                    <a
                      href={orgData.socialLinks.twitter}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-surface px-2.5 py-1 text-ink hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      X / Twitter <ExternalLink size={10} />
                    </a>
                  )}
                  {orgData.socialLinks.facebook && (
                    <a
                      href={orgData.socialLinks.facebook}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-surface px-2.5 py-1 text-ink hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      Facebook <ExternalLink size={10} />
                    </a>
                  )}
                  {orgData.socialLinks.instagram && (
                    <a
                      href={orgData.socialLinks.instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-surface px-2.5 py-1 text-ink hover:bg-primary/10 hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      Instagram <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Organization Details Summary */}
        <Card className="p-5 border-hairline-soft bg-white shadow-none">
          <div className="flex items-center justify-between border-b border-hairline-soft pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              <h3 className="text-base font-semibold text-heading">Details & Location</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(3)}
              className="h-8 gap-1.5 text-xs text-primary font-medium hover:bg-primary/5"
            >
              <Edit3 size={14} />
              Edit
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Industry</span>
              <span className="font-medium text-ink">{detailsData.industry || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Organization Type</span>
              <span className="font-medium text-ink">{detailsData.organizationType || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Company Size</span>
              <span className="font-medium text-ink">{detailsData.companySize || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Country</span>
              <span className="font-medium text-ink">{detailsData.country || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">City</span>
              <span className="font-medium text-ink">{detailsData.city || "—"}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Street Address</span>
              <span className="font-medium text-ink">{detailsData.address || "—"}</span>
            </div>
            {detailsData.phone && (
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">Org Phone</span>
                <span className="font-medium text-ink">{detailsData.phone}</span>
              </div>
            )}
            {detailsData.email && (
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider block mb-0.5">General Email</span>
                <span className="font-medium text-ink">{detailsData.email}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
