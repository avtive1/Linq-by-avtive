"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton } from "@/components/ui";

import { Clock, Lock, XCircle, CheckCircle2 } from "lucide-react";
import { useRegistrationStatusStream } from "@/lib/ui/useRegistrationRealtime";
import { HorizontalPreviewScaler } from "@/components/HorizontalPreviewScaler";
import { CardPreview } from "@/components/CardPreview";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";
import { parseEventSponsors } from "@/lib/sponsors";
import type { SponsorEntry } from "@/types/card";
import {
  type RegistrationFormConfig,
  getDefaultRegistrationFormConfig,
  getEnabledFieldsForRole,
  normalizeRegistrationFormConfig,
} from "@/lib/registration-form";
import { ATTENDEE_FIELD_LIMITS } from "@/lib/validation/attendee-fields";
import { waitForCardFontsReadyForCapture } from "@/lib/card-font-runtime";
import { logger } from "@/lib/logger-client";

const URL_OR_QUERY_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$)|[?=&])/i;

async function readResponsePayload(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => "");
  return text ? { error: text } : null;
}

function getPayloadError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function NewCardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "";
  const initialRole = (searchParams.get("role") as "guest" | "visitor") || "visitor";
  const initialGuestCategory = searchParams.get("guestCategory") || "";
  const cardRef = useRef<HTMLDivElement>(null);
  const verticalFrontRef = useRef<HTMLDivElement>(null);
  const verticalBackRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    eventName: "",
    sessionDate: "",
    sessionTime: "",
    location: "",
    track: "",
    photo: "",
    year: new Date().getFullYear().toString(),
    linkedin: "",
    designType: "design1" as const,
    color: "purple",
    horizontalTextColor: "",
    verticalTextColor: "",
    fontFamily: "inter",
    cardRole: initialRole,
    guestCategory: initialRole === "guest" ? initialGuestCategory : "",
    sponsors: [] as SponsorEntry[],
    organizationName: "",
    organizationLogoUrl: "",
  });
  const [registrationFormConfig, setRegistrationFormConfig] = useState<RegistrationFormConfig>(
    getDefaultRegistrationFormConfig(),
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});


  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [horizontalTextColor, setHorizontalTextColor] = useState("");
  const [verticalTextColor, setVerticalTextColor] = useState("");


  // Fetch event details for the locked header / preview.
  const [eventLoading, setEventLoading] = useState(!!eventId);
  const [eventPast, setEventPast] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    const fetchEvent = async () => {
      setEventLoading(true);
      try {
        const brandingRes = await fetch(`/api/events/${eventId}/branding`);
        const isJson = brandingRes.headers.get("content-type")?.includes("application/json");
        const brandingPayload = isJson ? await brandingRes.json() : null;
        if (!isMounted) return;
        if (!brandingRes.ok || !brandingPayload?.data?.eventName) {
          // Event branding unavailable — form stays editable with empty event fields.
        } else {
          const status = getEventStatus(String(brandingPayload.data.eventDate || ""));
          if (status.label === "Past") {
            setEventPast(true);
          }

          setForm((f) => ({
            ...f,
            eventName: String(brandingPayload.data.eventName || ""),
            location: String(brandingPayload.data.eventLocation || ""),
            sessionDate: String(brandingPayload.data.eventDate || ""),
            sessionTime: String(brandingPayload.data.eventTime || ""),
            color: String(brandingPayload.data.cardColor || "purple"),
            fontFamily: String(brandingPayload.data.cardFont || "inter"),
            sponsors: parseEventSponsors(brandingPayload.data.sponsors),
            organizationName: String(brandingPayload.data.organizationName || ""),
            organizationLogoUrl: String(brandingPayload.data.organizationLogoUrl || ""),
          }));
          setHorizontalTextColor(String(brandingPayload.data.horizontalTextColor || ""));
          setVerticalTextColor(String(brandingPayload.data.verticalTextColor || ""));
          setRegistrationFormConfig(
            normalizeRegistrationFormConfig(brandingPayload.data.registrationFormConfig),
          );
        }
      } catch {
        if (isMounted) {
          // Branding fetch failed — user can still fill the card manually.
        }
      }
      setEventLoading(false);
    };
    fetchEvent();
    return () => { isMounted = false; };
  }, [eventId]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registrationRequestId, setRegistrationRequestId] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvedCardId, setApprovedCardId] = useState<string | null>(null);
  const [approvedShareToken, setApprovedShareToken] = useState<string | null>(null);

  useRegistrationStatusStream(registrationRequestId, registrationStatus === "PENDING", {
    onStatus: (status) => {
      setRegistrationStatus(status.status);
      if (status.rejection_reason) setRejectionReason(status.rejection_reason);
      if (status.card_id) setApprovedCardId(status.card_id);
    },
    onApproved: (payload) => {
      setRegistrationStatus("APPROVED");
      if (payload.cardId) setApprovedCardId(payload.cardId);
      if (payload.shareToken) setApprovedShareToken(payload.shareToken);
    },
    onRejected: (payload) => {
      setRegistrationStatus("REJECTED");
      if (payload.rejectionReason) setRejectionReason(payload.rejectionReason);
    },
  });

  useEffect(() => {
    if (registrationStatus !== "APPROVED" || !approvedCardId) return;
    const nextUrl = approvedShareToken
      ? `/cards/${approvedCardId}?share=true&token=${encodeURIComponent(approvedShareToken)}`
      : `/cards/${approvedCardId}?share=true`;
    router.replace(nextUrl);
  }, [registrationStatus, approvedCardId, approvedShareToken, router]);

  const update = (key: string) => (val: string | number) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const enabledFields = getEnabledFieldsForRole(
    registrationFormConfig,
    form.cardRole === "guest" ? "guest" : "visitor",
  );
  const knownFieldIds = new Set(["name", "role", "company", "email", "linkedin", "photo"]);

  const updateCustomField = (fieldId: string) => (value: string) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    enabledFields.forEach((field) => {
      const value = knownFieldIds.has(field.id)
        ? String(form[field.id as keyof typeof form] || "")
        : String(customFieldValues[field.id] || "");
      if (field.required && !value.trim()) {
        newErrors[field.id] = `${field.label} is required`;
      }
    });
    
    // Explicit mandatory checks for Email and Organization
    if (enabledFields.some(f => f.id === "email") && !form.email.trim()) {
      newErrors.email = "Email is required";
    }
    if (enabledFields.some(f => f.id === "company") && !form.company.trim()) {
      newErrors.company = "Organization is required";
    }

    if (enabledFields.some((field) => field.id === "email") && form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }
    if (enabledFields.some((field) => field.id === "name")) {
      const name = String(form.name || "").trim();
      if (!name) newErrors.name = "Full Name is required";
      else if (name.length > ATTENDEE_FIELD_LIMITS.name) {
        newErrors.name = `Full Name must be ${ATTENDEE_FIELD_LIMITS.name} characters or less`;
      } else if (URL_OR_QUERY_PATTERN.test(name)) {
        newErrors.name = "Full Name cannot contain links or query text";
      }
    }
    if (enabledFields.some((field) => field.id === "role")) {
      const role = String(form.role || "").trim();
      if (!role) newErrors.role = "Designation is required";
      else if (role.length > ATTENDEE_FIELD_LIMITS.role) {
        newErrors.role = `Designation must be ${ATTENDEE_FIELD_LIMITS.role} characters or less`;
      } else if (URL_OR_QUERY_PATTERN.test(role)) {
        newErrors.role = "Designation cannot contain links or query text";
      }
    }
    if (enabledFields.some((field) => field.id === "company")) {
      const company = String(form.company || "").trim();
      if (!company) newErrors.company = "Organization is required";
      else if (company.length > ATTENDEE_FIELD_LIMITS.company) {
        newErrors.company = `Organization must be ${ATTENDEE_FIELD_LIMITS.company} characters or less`;
      } else if (URL_OR_QUERY_PATTERN.test(company)) {
        newErrors.company = "Organization cannot contain links or query text";
      }
    }
    enabledFields.forEach((field) => {
      const value = knownFieldIds.has(field.id)
        ? String(form[field.id as keyof typeof form] || "")
        : String(customFieldValues[field.id] || "");
      if (!value.trim()) return;
      if (field.inputType === "url" && !/^https?:\/\/|^[^.\s]+\.[^\s]+/.test(value.trim())) {
        newErrors[field.id] = "Enter a valid URL";
      }
      if (field.inputType === "number" && Number.isNaN(Number(value))) {
        newErrors[field.id] = "Enter a valid number";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatQrLink = (val: string) => {
    if (!val) return "";
    const clean = val.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      return clean;
    }
    if (clean.includes(".")) {
      return `https://${clean}`; // Treat as a domain/custom URL
    }
    return clean; // Store just the handle if it's a simple username
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validate()) return;
    setLoading(true);

    try {
      const fieldEnabled = (id: string) => enabledFields.some((field) => field.id === id);
      let photo_url = "";

      // 1. Handle user photo upload (if any)
      if (fieldEnabled("photo") && form.photo && form.photo.startsWith('data:')) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: form.photo, folder: `attendees/${eventId}` }),
        });
        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok || !uploadPayload?.data?.url) throw new Error(uploadPayload?.error || "Photo upload failed.");
        photo_url = String(uploadPayload.data.url);
      }

      // 2. Generate and Upload Social Preview Image BEFORE saving to DB
      let card_preview_url = "";
      if (cardRef.current) {
        try {
          const { toPng } = await import("html-to-image");
          await waitForCardFontsReadyForCapture(String(form.fontFamily || "inter"));
          const dataUrl = await toPng(cardRef.current, {
            quality: 1,
            pixelRatio: 2, // 2x for high resolution
            backgroundColor: "#ffffff",
          });

          if (dataUrl && dataUrl.length > 100) {
            const previewRes = await fetch("/api/media/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataUrl, folder: `card-previews/${eventId}` }),
            });
            const previewPayload = await previewRes.json();
            if (previewRes.ok && previewPayload?.data?.url) {
              card_preview_url = String(previewPayload.data.url);
            } else {
              const reason = String(previewPayload?.error || "Preview upload failed.");
              if (previewRes.status === 403) {
                logger.warn({ reason }, "Preview upload skipped due to folder permission");
              } else {
                logger.warn({ reason }, "Preview upload skipped");
              }
            }
          }
        } catch (previewErr) {
          logger.warn({ err: previewErr instanceof Error ? previewErr : undefined }, "Preview generation skipped");
        }
      }

      // 3. Save EVERYTHING in one single Insert call
      const attendeeCustomFields: Record<string, string> = Object.fromEntries(
        enabledFields
          .filter((field) => !knownFieldIds.has(field.id))
          .map((field) => [field.id, customFieldValues[field.id] || ""]),
      );
      const attendeeData = {
        user_id: null,
        name: form.name.trim(),
        role: form.role.trim(),
        company: fieldEnabled("company") ? form.company.trim() : "",
        card_email: fieldEnabled("email") ? form.email : "",
        event_name: form.eventName,
        session_date: form.sessionDate,
        session_time: form.sessionTime,
        location: form.location,
        linkedin: fieldEnabled("linkedin") ? formatQrLink(form.linkedin) : "",
        year: form.year,
        photo_url: fieldEnabled("photo") ? photo_url : "",
        card_preview_url: card_preview_url,
        event_id: eventId,
        design_type: "design1",
        card_color: form.color,
        track: form.cardRole,
        guest_category: form.cardRole === "guest" ? (form.guestCategory || null) : null,
        custom_fields: attendeeCustomFields,
      };

      const isGuestRegistration = form.cardRole === "guest";

      if (!isGuestRegistration) {
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attendeeData),
        });
        const body = await readResponsePayload(res);
        if (!res.ok) {
          const errorMessage = getPayloadError(body, "Failed to save card. Please try again.");
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }

        const createdId =
          body && typeof body === "object" && "data" in body
            ? (body as { data?: { id?: unknown } }).data?.id
            : undefined;
        const createdShareToken =
          body && typeof body === "object" && "shareToken" in body
            ? (body as { shareToken?: unknown }).shareToken
            : undefined;

        if (createdId) {
          try {
            const { toPng } = await import("html-to-image");
            const cardId = String(createdId);
            const uploadVertical = async (
              node: HTMLDivElement | null,
              suffix: "vertical-front" | "vertical-back",
            ) => {
              if (!node) return;
              await waitForCardFontsReadyForCapture(String(form.fontFamily || "inter"));
              const png = await toPng(node, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
              });
              if (!png || png.length <= 100) return;
              const uploadRes = await fetch("/api/media/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  dataUrl: png,
                  folder: `card-previews/${eventId}`,
                  publicId: `${cardId}-${suffix}`,
                }),
              });
              const uploadPayload = await readResponsePayload(uploadRes);
              const uploadUrl =
                uploadPayload && typeof uploadPayload === "object" && "data" in uploadPayload
                  ? (uploadPayload as { data?: { url?: unknown } }).data?.url
                  : undefined;
              if (!uploadRes.ok || !uploadUrl) {
                throw new Error(getPayloadError(uploadPayload, `Failed to upload ${suffix} preview.`));
              }
            };
            await uploadVertical(verticalFrontRef.current, "vertical-front");
            await uploadVertical(verticalBackRef.current, "vertical-back");
          } catch (verticalErr) {
            logger.warn({ err: verticalErr instanceof Error ? verticalErr : undefined }, "Vertical preview upload skipped");
          }
          toast.success("Attendee card saved successfully!");
          const nextUrl = createdShareToken
            ? `/cards/${String(createdId)}?share=true&token=${encodeURIComponent(String(createdShareToken))}`
            : `/cards/${String(createdId)}?share=true`;
          router.push(nextUrl);
        }
        return;
      }

      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendeeData),
      });
      const body = await readResponsePayload(res);
      if (!res.ok) {
        const errorMessage = getPayloadError(body, "Failed to submit registration. Please try again.");
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      const requestId =
        body && typeof body === "object" && "data" in body
          ? (body as { data?: { id?: unknown } }).data?.id
          : undefined;

      if (requestId) {
        setRegistrationRequestId(String(requestId));
        setRegistrationStatus("PENDING");
        toast.success("Guest registration submitted. Awaiting organizer approval.");
      }
    } catch (err: unknown) {
       const message = err instanceof Error ? err.message : "An unexpected error occurred.";
       logger.error({ err }, "Error creating card");
       toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!eventId) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm">
          <p className="text-heading font-semibold">Invalid registration link</p>
          <p className="text-sm text-muted">
            This page can only be opened from an event registration link provided by your organizer.
          </p>
          <Button href="/" variant="secondary" className="mt-2">
            Back to home
          </Button>
        </div>
      </main>
    );
  }

  if (registrationStatus === "PENDING") {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-6 glass-panel p-12 rounded-xl shadow-2xl max-w-md border border-primary/20">
          <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center text-primary-strong">
            <Clock size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Pending Approval</h2>
            <p className="text-sm text-muted leading-relaxed">
              Your request has been sent to the organization. Please wait for approval.
              We will email you when your registration is reviewed.
            </p>
          </div>
          <div className="w-full h-px bg-border/50" />
          <p className="text-xs text-muted/70">
            Event: <span className="font-medium text-heading">{form.eventName || "Your event"}</span>
          </p>
        </div>
      </main>
    );
  }

  if (registrationStatus === "REJECTED") {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-6 glass-panel p-12 rounded-xl shadow-2xl max-w-md border border-red-200/60">
          <div className="w-16 h-16 rounded-md bg-red-50 flex items-center justify-center text-red-600">
            <XCircle size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Request Rejected</h2>
            <p className="text-sm text-muted leading-relaxed">
              Your registration for <span className="font-medium text-heading">{form.eventName}</span> was not approved.
            </p>
            {rejectionReason ? (
              <p className="text-sm text-heading bg-red-50/80 border border-red-100 rounded-lg px-4 py-3 mt-2">
                <span className="font-medium">Reason:</span> {rejectionReason}
              </p>
            ) : null}
          </div>
          <Button href="/" variant="secondary" fullWidth className="mt-2 w-full">
            Back to Home
          </Button>
        </div>
      </main>
    );
  }

  if (registrationStatus === "APPROVED" && !approvedCardId) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-6 glass-panel p-12 rounded-xl shadow-2xl max-w-md border border-emerald-200/60">
          <div className="w-16 h-16 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={32} />
          </div>
          <p className="text-sm text-muted">Your registration was approved. Loading your card...</p>
        </div>
      </main>
    );
  }

  if (eventPast) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-6 glass-panel p-12 rounded-xl shadow-2xl max-w-md border border-amber-500/20">
          <div className="w-16 h-16 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Lock size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-heading tracking-[-0.03em] leading-[1.15]">Registration Expired</h2>
            <p className="text-sm text-muted leading-relaxed">
              We&apos;re sorry, but the registration for <span className="font-medium text-heading">{form.eventName}</span> has ended as the event date has passed.
            </p>
          </div>
          <div className="w-full h-px bg-border/50" />
          <p className="text-xs text-muted/60 font-medium italic">
            If you are the organizer, please renew the event in your dashboard to reactivate registration.
          </p>
          <Button href="/" variant="secondary" fullWidth className="mt-2 w-full">
            Back to Home
          </Button>
        </div>
      </main>
    );
  }

  const previewData = { ...form, horizontalTextColor, verticalTextColor };

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-x-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-8 md:p-10 overflow-y-auto lg:h-screen animate-slide-up">
        <div className="flex items-center gap-4 mb-5">
          <span className="text-sm font-normal tracking-[0.01em] leading-tight text-muted/65">
            Avtive attendee portal
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-semibold text-heading tracking-[-0.03em] leading-[1.1]">
              Event Registration
            </h1>
            <p className="text-[15px] text-muted leading-normal">
              {form.cardRole === "guest"
                ? form.eventName
                  ? `Register as a guest for ${form.eventName}. Your card will be issued after organizer approval.`
                  : "Register as a guest. Your card will be issued after organizer approval."
                : form.eventName
                  ? `Register for ${form.eventName} and get your attendee card instantly.`
                  : "Register for the event to generate your attendee card."}
            </p>
          </div>

          {eventLoading && (
            <div className="flex items-center gap-2 text-xs font-medium text-primary-strong bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
              <Lock size={14} />
              Loading event details...
            </div>
          )}
          {!eventLoading && (
            <div className="flex items-center gap-2 text-xs font-medium text-primary-strong bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
              <Lock size={12} />
              Event details are pre-filled from the organizer.
            </div>
          )}

          <div className="flex flex-col gap-8">
            {enabledFields.map((field) => {
              if (field.id === "name") {
                return (
                  <TextInput
                    key={field.id}
                    label={field.label}
                    required
                    placeholder={field.placeholder || "Full Name"}
                    value={form.name}
                    error={errors.name}
                    maxLength={ATTENDEE_FIELD_LIMITS.name}
                    onChange={update("name")}
                  />
                );
              }
              if (field.id === "role") {
                return (
                  <TextInput
                    key={field.id}
                    label={field.label}
                    required
                    placeholder={field.placeholder || "Designation"}
                    value={form.role}
                    error={errors.role}
                    maxLength={ATTENDEE_FIELD_LIMITS.role}
                    onChange={update("role")}
                  />
                );
              }
              if (field.id === "company") {
                return (
                  <TextInput
                    key={field.id}
                    label={field.label}
                    required={true}
                    placeholder={field.placeholder || "Organization"}
                    value={form.company}
                    error={errors.company}
                    maxLength={ATTENDEE_FIELD_LIMITS.company}
                    onChange={update("company")}
                  />
                );
              }
              if (field.id === "email") {
                return (
                  <TextInput
                    key={field.id}
                    label={field.label}
                    required={true}
                    type="email"
                    icon="email"
                    placeholder={field.placeholder || "hello@example.com"}
                    value={form.email}
                    error={errors.email}
                    onChange={update("email")}
                  />
                );
              }
              if (field.id === "linkedin") {
                return (
                  <TextInput
                    key={field.id}
                    label={field.label}
                    required={field.required}
                    type="url"
                    placeholder={field.placeholder || "https://"}
                    value={form.linkedin}
                    error={errors.linkedin}
                    onChange={update("linkedin")}
                  />
                );
              }
              if (field.id === "photo") {
                return (
                  <FilePicker
                    key={field.id}
                    label={field.label}
                    required={field.required}
                    value={form.photo}
                    onChange={update("photo")}
                    onError={(msg) => toast.error(msg)}
                    error={errors.photo}
                    freeFormCrop={false}
                    cropAspect={1}
                    cropTitle="Crop photo"
                    cropSubtitle="Adjust the photo within the fixed square frame shown on the card."
                    cropApplyLabel="Apply photo"
                  />
                );
              }
              return (
                <TextInput
                  key={field.id}
                  label={field.label}
                  required={field.required}
                  type={field.inputType}
                  placeholder={field.placeholder || field.label}
                  value={customFieldValues[field.id] || ""}
                  error={errors[field.id]}
                  onChange={updateCustomField(field.id)}
                />
              );
            })}

          </div>

        </form>
      </div>

      <div 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '1200px', 
          height: '628px',
          overflow: 'hidden'
        }}
      >
        <div ref={cardRef} style={{ width: '1200px', height: '628px' }}>
          <CardPreview data={previewData} />
        </div>
        <div ref={verticalFrontRef} style={{ width: '576px', height: '1024px' }}>
          <CardPreview data={previewData} isVertical verticalSide={1} />
        </div>
        <div ref={verticalBackRef} style={{ width: '576px', height: '1024px' }}>
          <CardPreview data={previewData} isVertical verticalSide={2} />
        </div>
      </div>

        {/* Right Content - Preview */}
        <div className="flex-1 flex min-w-0 flex-col items-stretch py-12 px-6 sm:px-8 lg:px-12 lg:h-screen min-h-[500px] lg:min-h-0 overflow-x-hidden overflow-y-auto animate-slide-up delay-100">

          <div className="flex w-full min-w-0 flex-1 flex-col items-stretch justify-start px-4 sm:px-6 xl:px-8 pt-8">
             <div className="flex w-full min-w-0 max-w-[1320px] flex-col xl:flex-row gap-8 xl:gap-12 items-center xl:items-start justify-center mx-auto min-h-max">
                {/* Horizontal Card Preview */}
                <div className="flex min-w-0 max-w-full w-full xl:w-auto flex-col items-center gap-8 shrink xl:shrink-0">
                   <h3 className="w-full text-center text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/55">Social post layout</h3>
                   <HorizontalPreviewScaler className="horizontal-preview-frame">
                      <div className="preview-card-capture">
                        <CardPreview data={previewData} preview />
                      </div>
                   </HorizontalPreviewScaler>
                </div>

                <div className="flex min-w-0 max-w-full w-full xl:w-auto flex-col items-center gap-8 animate-fade-in shrink xl:shrink-0">
                  <h3 className="w-full text-center text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/55">Event badge layout</h3>
                  <div className="vertical-preview-frame mt-1">
                    <div className="preview-card-capture vertical-preview">
                      <CardPreview data={previewData} preview isVertical verticalSide={2} />
                    </div>
                  </div>
                </div>
             </div>
             <div className="mt-8 flex justify-center">
               <Button
                 variant="secondary"
                 onClick={() => handleSubmit()}
                 disabled={loading}
                 className="rounded-md h-12 min-w-[160px] px-7 bg-white text-heading border border-border/60 shadow-xl hover:bg-white/95 hover:-translate-y-1 active:translate-y-0 transition-all font-medium text-sm tracking-[0.01em]"
               >
                 {loading
                   ? form.cardRole === "guest"
                     ? "Submitting..."
                     : "Saving..."
                   : form.cardRole === "guest"
                     ? "Submit Guest Registration"
                     : "Save"}
               </Button>
             </div>
          </div>
        <div className="w-full max-w-[1040px] mt-8 animate-slide-up bg-white/45 border border-white/20 px-6 py-6 sm:px-8 sm:py-8 rounded-xl glass-panel shadow-md backdrop-blur-xl">
          <p className="text-sm text-muted text-center lg:text-left">
            Card branding is managed by the event organization. You can edit attendee details and preview the finalized event design.
          </p>
        </div>


        {/* Print Preview Overlay */}
        {showPrintPreview && (
          <div className="fixed inset-0 z-100 bg-black/90 backdrop-blur-xl flex flex-col items-center p-8 overflow-y-auto animate-fade-in print:bg-white print:p-0 print:block">
             <div className="w-full max-w-4xl flex justify-between items-center mb-12 print:hidden">
                <h2 className="text-xl font-semibold text-white tracking-[-0.03em] leading-[1.15]">Print Ready Badge</h2>
                <div className="flex gap-4">
                   <Button variant="secondary" onClick={() => setShowPrintPreview(false)}>Close Overlay</Button>
                   <Button onClick={() => window.print()}>Print Card Now</Button>
                </div>
             </div>

             <div className="flex flex-col lg:flex-row gap-12 print:flex-col print:gap-20 print:items-center">
                <div className="flex flex-col items-center gap-6">
                   <span className="text-[13px] font-medium text-white/50 tracking-[0.01em] leading-tight print:hidden">Front side (Photo)</span>
                   <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={previewData} isVertical verticalSide={1} />
                   </div>
                </div>
                <div className="flex flex-col items-center gap-6">
                   <span className="text-[13px] font-medium text-white/50 tracking-[0.01em] leading-tight print:hidden">Back side (QR)</span>
                   <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={previewData} isVertical verticalSide={2} />
                   </div>
                </div>
             </div>

             <div className="mt-24 p-8 border border-white/10 rounded-xl bg-white/5 max-w-lg text-center print:hidden">
                <p className="text-sm text-white/60 mb-4 leading-relaxed">
                  For the best experience, use heavy cardstock and set your printer to <b>Portrait</b> with <b>Default</b> margins.
                </p>
                <p className="text-[13px] font-medium text-primary tracking-[0.01em] leading-tight">Fold along the center after printing</p>
             </div>
          </div>
        )}

      </div>

      {/* Responsive scale styles */}
      <style>{`
        .horizontal-preview-frame {
          position: relative;
          width: 780px;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          aspect-ratio: 1200 / 628;
          height: auto;
          overflow: hidden;
          display: block;
          margin-inline: auto;
        }
        .vertical-preview-frame {
          width: 304px;
          height: 496px;
          display: flex;
          justify-content: center;
          overflow: hidden;
        }
        .vertical-preview {
          position: relative;
          width: 576px;
          height: 1024px;
          transform-origin: top center;
          transform: scale(0.484);
        }
        @media (max-width: 1279px) {
          .horizontal-preview-frame {
            position: relative;
            width: 100%;
            max-width: 780px;
            min-width: 0;
            aspect-ratio: 1200 / 628;
            height: auto;
            overflow: hidden;
            margin-inline: auto;
          }
          .vertical-preview-frame {
            container-type: inline-size;
            width: min(272px, 100%);
            aspect-ratio: 576 / 1024;
            height: auto;
            display: flex;
            justify-content: center;
            overflow: hidden;
          }
          .vertical-preview {
            position: relative;
            transform-origin: top center;
            transform: scale(min(0.468, max(0.15, calc((100cqi - 16px) / 576))));
            width: 576px;
            height: 1024px;
          }
        }
        @media print {
           body { background: white !important; }
           /* Sidebar only — do not use blanket \`p\`/\`h3\` hides or CardPreview text disappears */
           .glass-panel { display: none !important; }
           .fixed {
             position: relative !important;
             background: white !important;
             display: block !important;
             padding: 0 !important;
             inset: auto !important;
           }
           @page { margin: 1cm; size: auto; }
        }
      `}</style>

    </main>
  );
}

// Default export wraps the form in Suspense (required for useSearchParams)
export default function NewCardPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-Hidden">
        <GradientBackground />

        {/* Skeleton Sidebar */}
        <div className="relative z-10 w-full lg:w-[460px] glass-panel p-8 md:p-12 lg:h-screen">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Skeleton className="w-48 h-10" />
              <Skeleton className="w-full h-4" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
            </div>
            <Skeleton className="w-full h-12 rounded-lg mt-4" />
          </div>
        </div>

        {/* Skeleton Preview */}
        <div className="flex-1 flex flex-col items-center py-8 px-6 lg:h-screen">
          <Skeleton className="w-24 h-4 mb-6" />
          <Skeleton className="w-full max-w-[600px] aspect-800/420 rounded-xl shadow-xl" />
          <Skeleton className="w-48 h-4 mt-6" />
        </div>
      </main>
    }>
      <NewCardForm />
    </Suspense>
  );
}
