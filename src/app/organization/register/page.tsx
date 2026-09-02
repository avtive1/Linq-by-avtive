"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Building2, AlertCircle, Sparkles } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger-client";

import { RegistrationProgressBar, type StepNumber } from "./_components/RegistrationProgressBar";
import { ContactInfoStep, type ContactFormData } from "./_components/ContactInfoStep";
import { OrganizationInfoStep, type OrganizationFormData } from "./_components/OrganizationInfoStep";
import { OrganizationDetailsStep, type OrganizationDetailsFormData } from "./_components/OrganizationDetailsStep";
import { ReviewStep } from "./_components/ReviewStep";
import { RegistrationSuccessView } from "./_components/RegistrationSuccessView";

function OrganizationRegisterForm() {
  const searchParams = useSearchParams();
  const editRef = searchParams.get("ref")?.trim() || "";

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<StepNumber>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [changesRequestedNotes, setChangesRequestedNotes] = useState<string | null>(null);

  // Success screen state
  const [submittedData, setSubmittedData] = useState<{
    referenceNumber: string;
    organizationName: string;
    contactEmail: string;
  } | null>(null);

  // Form State
  const [contactData, setContactData] = useState<ContactFormData>({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactDesignation: "",
    contactLinkedin: "",
  });

  const [orgData, setOrgData] = useState<OrganizationFormData>({
    organizationName: "",
    organizationWebsite: "",
    organizationDescription: "",
    organizationLogo: "",
    socialLinks: {
      linkedin: "",
      twitter: "",
      facebook: "",
      instagram: "",
    },
  });

  const [detailsData, setDetailsData] = useState<OrganizationDetailsFormData>({
    industry: "",
    organizationType: "",
    companySize: "",
    country: "",
    city: "",
    address: "",
    phone: "",
    email: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing data if editRef is provided
  useEffect(() => {
    if (!editRef) return;
    async function fetchExisting() {
      setIsLoadingExisting(true);
      try {
        const res = await fetch(`/api/organization-registration?ref=${encodeURIComponent(editRef)}`);
        const payload = await res.json();
        if (!res.ok || !payload?.data) {
          toast.error(payload?.error || "Could not load existing registration request.");
          return;
        }

        const data = payload.data;
        if (data.status === "CHANGES_REQUESTED" && data.changesRequestedNotes) {
          setChangesRequestedNotes(data.changesRequestedNotes);
        }

        setContactData({
          contactName: data.contactName || "",
          contactEmail: data.contactEmail || "",
          contactPhone: data.contactPhone || "",
          contactDesignation: data.contactDesignation || "",
          contactLinkedin: data.contactLinkedin || "",
        });

        setOrgData({
          organizationName: data.organizationName || "",
          organizationWebsite: data.organizationWebsite || "",
          organizationDescription: data.organizationDescription || "",
          organizationLogo: data.organizationLogoUrl || "",
          socialLinks: data.socialLinks || {},
        });

        setDetailsData({
          industry: data.industry || "",
          organizationType: data.organizationType || "",
          companySize: data.companySize || "",
          country: data.country || "",
          city: data.city || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
        });

        setMaxAccessibleStep(4);
      } catch (err: unknown) {
        logger.error({ err }, "Failed to fetch existing registration");
        toast.error("Failed to load registration details.");
      } finally {
        setIsLoadingExisting(false);
      }
    }

    fetchExisting();
  }, [editRef]);

  // Validation functions
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!contactData.contactName.trim()) {
      errs.contactName = "Full name is required.";
    } else if (contactData.contactName.trim().length < 2) {
      errs.contactName = "Full name must be at least 2 characters.";
    }

    if (!contactData.contactEmail.trim()) {
      errs.contactEmail = "Work email address is required.";
    } else if (!/\S+@\S+\.\S+/.test(contactData.contactEmail.trim())) {
      errs.contactEmail = "Please enter a valid email address.";
    }

    if (!contactData.contactPhone.trim()) {
      errs.contactPhone = "Phone number is required.";
    } else if (contactData.contactPhone.trim().length < 6) {
      errs.contactPhone = "Please enter a valid phone number.";
    }

    if (!contactData.contactDesignation.trim()) {
      errs.contactDesignation = "Job title / designation is required.";
    }

    if (contactData.contactLinkedin.trim()) {
      try {
        const u = new URL(contactData.contactLinkedin.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errs.contactLinkedin = "URL must start with http:// or https://";
        }
      } catch {
        errs.contactLinkedin = "Please enter a valid URL (e.g. https://linkedin.com/in/...).";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs: Record<string, string> = {};
    if (!orgData.organizationName.trim()) {
      errs.organizationName = "Organization name is required.";
    } else if (orgData.organizationName.trim().length < 2) {
      errs.organizationName = "Organization name must be at least 2 characters.";
    }

    if (orgData.organizationWebsite.trim()) {
      try {
        const u = new URL(orgData.organizationWebsite.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errs.organizationWebsite = "URL must start with http:// or https://";
        }
      } catch {
        errs.organizationWebsite = "Please enter a valid website URL.";
      }
    }

    if (!orgData.organizationLogo) {
      errs.organizationLogo = "Organization logo is required.";
    }

    // Validate social links if provided
    Object.entries(orgData.socialLinks).forEach(([key, val]) => {
      if (val && val.trim()) {
        try {
          const u = new URL(val.trim());
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            errs[`socialLinks.${key}`] = "URL must start with http:// or https://";
          }
        } catch {
          errs[`socialLinks.${key}`] = "Please enter a valid URL.";
        }
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs: Record<string, string> = {};
    if (detailsData.email && detailsData.email.trim()) {
      if (!/\S+@\S+\.\S+/.test(detailsData.email.trim())) {
        errs.email = "Please enter a valid email address.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    let isValid = false;
    if (currentStep === 1) isValid = validateStep1();
    else if (currentStep === 2) isValid = validateStep2();
    else if (currentStep === 3) isValid = validateStep3();

    if (isValid) {
      setErrors({});
      const next = (currentStep + 1) as StepNumber;
      setCurrentStep(next);
      setMaxAccessibleStep((prev) => Math.max(prev, next) as StepNumber);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setErrors({});
      setCurrentStep((prev) => (prev - 1) as StepNumber);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleEditStep = (step: StepNumber) => {
    setErrors({});
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      toast.error("Please fill in all required fields accurately.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalLogoUrl = orgData.organizationLogo;

      // If user uploaded a new base64 image, upload it to Cloudinary via /api/media/upload
      if (finalLogoUrl.startsWith("data:")) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl: finalLogoUrl,
            folder: "organization-logos",
          }),
        });

        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok || !uploadPayload?.data?.url) {
          throw new Error(uploadPayload?.error || "Organization logo upload failed.");
        }
        finalLogoUrl = String(uploadPayload.data.url);
      }

      const payload = {
        contactName: contactData.contactName.trim(),
        contactEmail: contactData.contactEmail.trim(),
        contactPhone: contactData.contactPhone.trim(),
        contactDesignation: contactData.contactDesignation.trim(),
        contactLinkedin: contactData.contactLinkedin.trim() || undefined,
        organizationName: orgData.organizationName.trim(),
        organizationWebsite: orgData.organizationWebsite.trim() || undefined,
        organizationDescription: orgData.organizationDescription.trim() || undefined,
        organizationLogoUrl: finalLogoUrl,
        socialLinks: orgData.socialLinks,
        industry: detailsData.industry.trim() || undefined,
        organizationType: detailsData.organizationType.trim() || undefined,
        companySize: detailsData.companySize.trim() || undefined,
        country: detailsData.country.trim() || undefined,
        city: detailsData.city.trim() || undefined,
        address: detailsData.address.trim() || undefined,
        phone: detailsData.phone.trim() || undefined,
        email: detailsData.email.trim() || undefined,
        referenceNumber: editRef || undefined,
      };

      const res = await fetch("/api/organization-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = await res.json();
      if (!res.ok) {
        throw new Error(responsePayload?.error || "Registration submission failed.");
      }

      const created = responsePayload.data;
      setSubmittedData({
        referenceNumber: created.referenceNumber,
        organizationName: created.organizationName,
        contactEmail: contactData.contactEmail.trim(),
      });
      toast.success("Organization registration submitted successfully!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit registration.";
      logger.error({ err }, "Registration submission error");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedData) {
    return (
      <RegistrationSuccessView
        referenceNumber={submittedData.referenceNumber}
        organizationName={submittedData.organizationName}
        contactEmail={submittedData.contactEmail}
      />
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col items-center text-center gap-2">
        <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/10 text-primary font-semibold px-3 py-1 text-xs">
          <Building2 size={13} />
          Organization Onboarding
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-heading">
          Register Your Organization
        </h1>
        <p className="text-sm text-muted max-w-lg">
          Join Linq to create branded event campaigns, issue verified digital badges, and streamline attendee check-ins.
        </p>
      </div>

      {/* Changes Requested Banner */}
      {changesRequestedNotes && (
        <Card className="p-4 border-amber-300 bg-amber-50 text-amber-900 shadow-sm animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">Reviewer Requested Changes</h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed whitespace-pre-wrap">
                {changesRequestedNotes}
              </p>
              <p className="text-[11px] text-amber-700 font-medium mt-2">
                Please update the required information below and resubmit for review.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Progress Bar */}
      <Card className="p-4 sm:p-5 border-hairline-soft bg-white shadow-sm">
        <RegistrationProgressBar
          currentStep={currentStep}
          onStepClick={(step) => handleEditStep(step)}
          maxAccessibleStep={maxAccessibleStep}
        />
      </Card>

      {/* Step Form Card */}
      <Card className="p-6 sm:p-8 border-hairline-soft bg-white shadow-md">
        {isLoadingExisting ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium">Loading registration details...</p>
          </div>
        ) : (
          <>
            {currentStep === 1 && (
              <ContactInfoStep
                data={contactData}
                errors={errors}
                onChange={(field, val) => setContactData((prev) => ({ ...prev, [field]: val }))}
              />
            )}

            {currentStep === 2 && (
              <OrganizationInfoStep
                data={orgData}
                errors={errors}
                onChange={(field, val) => setOrgData((prev) => ({ ...prev, [field]: val }))}
                onSocialChange={(platform, val) =>
                  setOrgData((prev) => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, [platform]: val },
                  }))
                }
                onLogoError={(msg) => toast.error(msg)}
              />
            )}

            {currentStep === 3 && (
              <OrganizationDetailsStep
                data={detailsData}
                errors={errors}
                onChange={(field, val) => setDetailsData((prev) => ({ ...prev, [field]: val }))}
              />
            )}

            {currentStep === 4 && (
              <ReviewStep
                contactData={contactData}
                orgData={orgData}
                detailsData={detailsData}
                onEditStep={handleEditStep}
              />
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-hairline-soft pt-6 mt-8">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="gap-2 border-hairline-strong font-medium"
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
              ) : (
                <Link href="/">
                  <Button type="button" variant="ghost" className="text-xs text-muted hover:text-ink">
                    Cancel
                  </Button>
                </Link>
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={handleNext}
                  className="gap-2 bg-primary text-primary-foreground font-semibold px-6 ml-auto"
                >
                  Continue
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2 bg-primary text-primary-foreground font-semibold px-8 ml-auto shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting Registration...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {editRef ? "Resubmit Registration" : "Submit Registration"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Footer / Login Link */}
      <div className="text-center text-xs text-muted pb-8">
        Already have an approved account?{" "}
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Sign In
        </Link>{" "}
        or{" "}
        <Link href="/organization/status" className="text-primary font-semibold hover:underline">
          Check Registration Status
        </Link>
      </div>
    </div>
  );
}

export default function OrganizationRegisterPage() {
  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />

      {/* Top Navbar */}
      <header className="relative z-50 border-b border-hairline-soft bg-white/80 backdrop-blur-xl shadow-xs">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/linq-logo.png"
              alt="Linq logo"
              width={100}
              height={28}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/organization/status">
              <Button variant="ghost" size="sm" className="text-xs font-medium text-muted hover:text-ink">
                Check Status
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-xs font-semibold border-hairline-strong">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-8 sm:py-12">
        <Suspense
          fallback={
            <div className="py-24 text-center text-muted">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
              Loading registration portal...
            </div>
          }
        >
          <OrganizationRegisterForm />
        </Suspense>
      </main>
    </div>
  );
}
