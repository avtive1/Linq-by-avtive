"use client";
import { useState, useEffect, use, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton } from "@/components/ui";
import { CardTypographyPicker } from "@/components/CardTypographyPicker";
import { ArrowLeft } from "lucide-react";
import { HorizontalPreviewScaler } from "@/components/HorizontalPreviewScaler";
import { VerticalPreviewScaler } from "@/components/VerticalPreviewScaler";
import { CardPreview } from "@/components/CardPreview";
import { CustomColorPicker } from "@/components/CustomColorPicker";
import { toast } from "sonner";
import { parseEventSponsors } from "@/lib/sponsors";
import type { SponsorEntry } from "@/types/card";
import { logSecurityEvent } from "@/lib/security/telemetry-client";
import { isValidUuid } from "@/lib/validation/uuid";
import { logger } from "@/lib/logger-client";
import { ATTENDEE_FIELD_LIMITS } from "@/lib/validation/attendee-fields";
import { waitForCardFontsReadyForCapture } from "@/lib/card-font-runtime";

const URL_OR_QUERY_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$)|[?=&])/i;

type FormState = {
  name: string;
  role: string;
  company: string;
  email: string;
  eventName: string;
  sessionDate: string;
  sessionTime: string;
  location: string;
  track: string;
  photo: string;
  year: string;
  linkedin: string;
  designType: "design1";
  color: string;
  horizontalTextColor: string;
  verticalTextColor: string;
  fontFamily: string;
  sponsors: SponsorEntry[];
  organizationName: string;
  organizationLogoUrl: string;
};

const colors = [
  { name: "purple", start: "#41295a", end: "#2f0743" },
  { name: "red",    start: "#c94b4b", end: "#4b134f" },
  { name: "pink",   start: "#EE0979", end: "#FF6A00" },
  { name: "blue",   start: "#D3CCE3", end: "#E9E4F0" },
];
const presetColorNames = new Set(colors.map((c) => c.name));

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

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);
  const shareToken = String(searchParams.get("token") || "").trim();
  const isShareEditMode = searchParams.get("share") === "true";
  const canCustomizeBranding = !shareToken && !isShareEditMode;
  const cardRef = useRef<HTMLDivElement>(null);
  const verticalFrontRef = useRef<HTMLDivElement>(null);
  const verticalBackRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({
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
    designType: "design1",
    color: "purple",
    horizontalTextColor: "",
    verticalTextColor: "",
    fontFamily: "inter",
    sponsors: [],
    organizationName: "",
    organizationLogoUrl: "",
  });
  
  const [originalPhotoPath, setOriginalPhotoPath] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [draftCustomColor, setDraftCustomColor] = useState("#2563EB");
  const [customColorAnchorRect, setCustomColorAnchorRect] = useState<DOMRect | null>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [draftTextColor, setDraftTextColor] = useState("#FFFFFF");
  const [textColorAnchorRect, setTextColorAnchorRect] = useState<DOMRect | null>(null);
  const [activeTextTarget, setActiveTextTarget] = useState<"horizontal" | "vertical">("horizontal");
  const [horizontalTextColor, setHorizontalTextColor] = useState("");
  const [verticalTextColor, setVerticalTextColor] = useState("");
  const [existingCustomFields, setExistingCustomFields] = useState<Record<string, unknown>>({});
  const [identityLocked, setIdentityLocked] = useState(false);
  const isCustomColorSelected = !presetColorNames.has(form.color);
  const isCustomPickerActive = showCustomColorPicker || isCustomColorSelected;
  const previewData = { ...form, horizontalTextColor, verticalTextColor };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!isValidUuid(id)) {
          if (isMounted) setNotFound(true);
          return;
        }
        const authHeaders = shareToken ? { Authorization: `Bearer ${shareToken}` } : undefined;
        if (!shareToken) {
          const authRes = await fetch("/api/auth/me");
          const authPayload = await authRes.json();
          const userId = authPayload?.data?.userId ? String(authPayload.data.userId) : "";
          if (!isMounted) return;
          if (!userId) {
            router.replace("/login");
            return;
          }
        }

        const resp = await fetch(`/api/cards/${id}`, { method: "GET", headers: authHeaders });
        if (resp.status === 404) {
          if (isMounted) setNotFound(true);
          return;
        }
        if (resp.status === 403) {
          if (isMounted) setUnauthorized(true);
          return;
        }
        if (!resp.ok) {
          throw new Error("Failed to load secure card data.");
        }
        const payload = await resp.json();
        const record = payload.data;
        const locked = Boolean(payload.identityLocked);

        if (!isMounted) return;
        setIdentityLocked(locked);
        setEventId(record.event_id || null);
        setOriginalPhotoPath(record.photo_url || null);

        let sponsors: SponsorEntry[] = [];
        let organizationName = "";
        let organizationLogoUrl = "";
        let resolvedEventName = String(record.event_name || "");
        let resolvedSessionDate = String(record.session_date || "");
        let resolvedSessionTime = String(record.session_time || "");
        let resolvedLocation = String(record.location || "");
        if (record.event_id) {
          try {
            const brandingRes = await fetch(`/api/events/${record.event_id}/branding`);
            const isJson = brandingRes.headers.get("content-type")?.includes("application/json");
            const brandingPayload = isJson ? await brandingRes.json() : null;
            if (brandingRes.ok && brandingPayload?.data) {
              sponsors = parseEventSponsors(brandingPayload.data.sponsors);
              organizationName = String(brandingPayload.data.organizationName || "");
              organizationLogoUrl = String(brandingPayload.data.organizationLogoUrl || "");
              resolvedEventName = String(brandingPayload.data.eventName || resolvedEventName);
              resolvedSessionDate = String(brandingPayload.data.eventDate || resolvedSessionDate);
              resolvedSessionTime = String(brandingPayload.data.eventTime || resolvedSessionTime);
              resolvedLocation = String(brandingPayload.data.eventLocation || resolvedLocation);
            }
          } catch {
          }
        }

        setForm({
          name: record.name || "",
          role: record.role || "",
          company: record.company || "",
          email: record.card_email || "",
          eventName: resolvedEventName,
          sessionDate: resolvedSessionDate,
          sessionTime: resolvedSessionTime,
          location: resolvedLocation,
          track: record.track || "",
          photo: record.photo_url || "",
          year: record.year || new Date().getFullYear().toString(),
          linkedin: record.linkedin || "",
          designType: "design1",
          color: record.card_color || "purple",
          horizontalTextColor: "",
          verticalTextColor: "",
          fontFamily: "inter",
          sponsors,
          organizationName,
          organizationLogoUrl,
        });
        const customFieldsRaw = (record.custom_fields && typeof record.custom_fields === "object" && !Array.isArray(record.custom_fields))
          ? (record.custom_fields as Record<string, unknown>)
          : {};
        setExistingCustomFields(customFieldsRaw);
        const savedHorizontalTextColor = String(customFieldsRaw.__horizontal_text_color || "").trim();
        const savedVerticalTextColor = String(customFieldsRaw.__vertical_text_color || "").trim();
        setHorizontalTextColor(savedHorizontalTextColor);
        setVerticalTextColor(savedVerticalTextColor);
      } catch {
        toast.error("Failed to load card.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [id, router, shareToken]);

  const update = (key: keyof FormState) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const requiredFields: Array<[keyof FormState, string]> = [
      ["name", "Full Name"],
      ["role", "Role/Title"],
      ["company", "Organization"],
      ["email", "Email"],
    ];
    requiredFields.forEach(([key, label]) => {
      if (!form[key]) newErrors[key] = `${label} is required`;
    });
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }
    const name = String(form.name || "").trim();
    if (name.length > ATTENDEE_FIELD_LIMITS.name) {
      newErrors.name = `Full Name must be ${ATTENDEE_FIELD_LIMITS.name} characters or less`;
    } else if (name && URL_OR_QUERY_PATTERN.test(name)) {
      newErrors.name = "Full Name cannot contain links or query text";
    }
    const role = String(form.role || "").trim();
    if (role.length > ATTENDEE_FIELD_LIMITS.role) {
      newErrors.role = `Role/Title must be ${ATTENDEE_FIELD_LIMITS.role} characters or less`;
    } else if (role && URL_OR_QUERY_PATTERN.test(role)) {
      newErrors.role = "Role/Title cannot contain links or query text";
    }
    const company = String(form.company || "").trim();
    if (company.length > ATTENDEE_FIELD_LIMITS.company) {
      newErrors.company = `Organization must be ${ATTENDEE_FIELD_LIMITS.company} characters or less`;
    } else if (company && URL_OR_QUERY_PATTERN.test(company)) {
      newErrors.company = "Organization cannot contain links or query text";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatQrLink = (val: string) => {
    if (!val) return "";
    const clean = val.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
    if (clean.includes(".")) return `https://${clean}`;
    return clean;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);

    try {
      let photo_url = originalPhotoPath || "";

      // If the user picked a new photo, form.photo will be a fresh data URL.
      if (form.photo && form.photo.startsWith("data:")) {
        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: form.photo, folder: `attendees/${eventId || "general"}` }),
        });
        const uploadPayload = await readResponsePayload(uploadRes);
        const uploadedUrl =
          uploadPayload && typeof uploadPayload === "object" && "data" in uploadPayload
            ? (uploadPayload as { data?: { url?: unknown } }).data?.url
            : undefined;
        if (!uploadRes.ok || !uploadedUrl) {
          toast.error("Failed to upload photo.");
          throw new Error(getPayloadError(uploadPayload, "Photo upload failed."));
        }

        if (originalPhotoPath) {
          const deleteRes = await fetch("/api/media/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: originalPhotoPath }),
          });
          const deletePayload = await deleteRes.json().catch(() => null);
          if (!deleteRes.ok || deletePayload?.success !== true) {
            throw new Error(deletePayload?.error || "Failed to delete old photo.");
          }
        }
        photo_url = String(uploadedUrl || "");
      }

      const updatePayload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role.trim(),
        company: form.company.trim(),
        card_email: form.email,
        track: form.track || "",
        linkedin: formatQrLink(form.linkedin),
        photo_url,
      };
      if (canCustomizeBranding) {
        updatePayload.design_type = "design1";
        updatePayload.card_color = form.color;
      }
      const nextCustomFields: Record<string, unknown> = { ...existingCustomFields };
      if (canCustomizeBranding) {
        if (horizontalTextColor.trim()) nextCustomFields.__horizontal_text_color = horizontalTextColor.trim();
        else delete nextCustomFields.__horizontal_text_color;
        if (verticalTextColor.trim()) nextCustomFields.__vertical_text_color = verticalTextColor.trim();
        else delete nextCustomFields.__vertical_text_color;
      } else {
        delete nextCustomFields.__horizontal_text_color;
        delete nextCustomFields.__vertical_text_color;
      }
      updatePayload.custom_fields = nextCustomFields;

      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(shareToken ? { Authorization: `Bearer ${shareToken}` } : {}),
        },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errorData = await readResponsePayload(res);
        const errorMessage = getPayloadError(errorData, "Failed to save changes.");
        logSecurityEvent({
          event: "security.attendees.update_failed",
          level: "error",
          resourceId: id,
          details: { reason: errorMessage },
        });
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      try {
        const { toPng } = await import("html-to-image");
        if (!eventId) {
          // Vertical preview upload requires event-scoped folder authorization.
          router.refresh();
          router.push(
            shareToken
              ? `/cards/${id}?share=true&token=${encodeURIComponent(shareToken)}`
              : `/cards/${id}`,
          );
          return;
        }
        const uploadPreview = async (
          node: HTMLDivElement | null,
          suffix: "horizontal" | "vertical-front" | "vertical-back",
        ) => {
          if (!node) return;
          try {
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
                publicId: `${id}-${suffix}`,
              }),
            });
            const uploadPayload = await uploadRes.json();
            if (!uploadRes.ok || !uploadPayload?.data?.url) {
              throw new Error(uploadPayload?.error || uploadRes.statusText);
            }
            return String(uploadPayload.data.url);
          } catch (verticalCaptureErr) {
            logger.warn({ err: verticalCaptureErr instanceof Error ? verticalCaptureErr : undefined, suffix }, "Preview generation/upload skipped");
          }
        };
        const horizontalUrl = await uploadPreview(cardRef.current, "horizontal");
        await uploadPreview(verticalFrontRef.current, "vertical-front");
        await uploadPreview(verticalBackRef.current, "vertical-back");
        if (horizontalUrl) {
          await fetch(`/api/cards/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(shareToken ? { Authorization: `Bearer ${shareToken}` } : {}),
            },
            body: JSON.stringify({ card_preview_url: horizontalUrl }),
          });
        }
      } catch (verticalErr) {
        logger.warn({ err: verticalErr instanceof Error ? verticalErr : undefined }, "Preview upload skipped");
      }
      toast.success("Card updated successfully.");
      setExistingCustomFields(nextCustomFields);
      router.refresh();
      const returnUrl = shareToken
        ? `/cards/${id}?share=true&token=${encodeURIComponent(shareToken)}`
        : "/cards/" + id + "?share=true";
      router.push(returnUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-hidden">
        <GradientBackground />
        <div className="relative z-10 w-full lg:w-[460px] glass-panel p-8 md:p-12 lg:h-screen">
          <div className="flex flex-col gap-8">
            <Skeleton className="w-48 h-10" />
            <div className="flex flex-col gap-6">
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
              <Skeleton className="w-full h-14 rounded-lg" />
            </div>
            <Skeleton className="w-full h-12 rounded-lg mt-4" />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center py-12 px-8 lg:px-12 lg:h-screen">
          <Skeleton className="w-24 h-4 mb-6" />
          <Skeleton className="w-full max-w-[600px] aspect-800/420 rounded-xl shadow-xl" />
          <Skeleton className="w-48 h-4 mt-6" />
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm">
          <p className="text-heading font-semibold">Card not found</p>
          <Button href="/dashboard" variant="secondary" className="mt-2">
            Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-8 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-xl shadow-2xl max-w-sm">
          <p className="text-heading font-semibold">You don&apos;t have permission to edit this card</p>
          <p className="text-sm text-muted">Only the event organizer can edit attendee cards.</p>
          <Button href="/dashboard" variant="secondary" className="mt-2">
            Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-x-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-8 md:p-12 overflow-y-auto lg:h-screen animate-slide-up">
        
        <div className="flex items-center gap-4 mb-12 -ml-1 sm:-ml-2">
          <button
            type="button"
            onClick={() => {
              const target = shareToken || isShareEditMode
                ? `/cards/${id}?share=true${shareToken ? `&token=${encodeURIComponent(shareToken)}` : ""}`
                : eventId
                  ? `/dashboard/events/${eventId}`
                  : "/dashboard";
              router.refresh();
              router.push(target);
            }}
            className="inline-flex items-center gap-2.5 text-base font-semibold text-heading hover:text-ink hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline group bg-transparent border-none cursor-pointer py-1"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold text-heading tracking-[-0.03em] leading-[1.1]">
              Edit Card
            </h1>
            <p className="text-base text-muted leading-[1.55]">
              Update the attendee details below.
            </p>
            {identityLocked ? (
              <p className="text-sm text-muted bg-surface/80 border border-border/50 rounded-lg px-3 py-2">
                Your name, organization, and email are locked after guest approval. Contact the organizer if any of these need to change.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-8">
            <TextInput
              label="Full Name"
              required
              placeholder="Full Name"
              value={form.name}
              error={errors.name}
              maxLength={ATTENDEE_FIELD_LIMITS.name}
              onChange={update("name")}
              readOnly={identityLocked}
            />
            <TextInput
              label="Role/Title"
              required
              placeholder="Role/Title"
              value={form.role}
              error={errors.role}
              maxLength={ATTENDEE_FIELD_LIMITS.role}
              onChange={update("role")}
            />
            <TextInput
              label="Organization"
              required
              placeholder="Organization"
              value={form.company}
              error={errors.company}
              maxLength={ATTENDEE_FIELD_LIMITS.company}
              onChange={update("company")}
              readOnly={identityLocked}
            />
            <TextInput
              label="Email"
              required
              icon="email"
              placeholder="hello@example.com"
              value={form.email}
              error={errors.email}
              onChange={update("email")}
              readOnly={identityLocked}
            />
            <TextInput
              label="QR Code Link (Optional)"
              placeholder="e.g. yourwebsite.com or social link"
              value={form.linkedin}
              onChange={update("linkedin")}
            />
            <FilePicker
              label="Photo (Optional)"
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
          </div>
        </form>
      </div>

      {/* Hidden container for high-resolution capture (Always 1:1 scale) */}
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
                  <HorizontalPreviewScaler className="w-full max-w-[780px] mx-auto">
                    <div className="preview-card-capture">
                      <CardPreview data={previewData} preview />
                    </div>
                  </HorizontalPreviewScaler>
              </div>

              <div className="flex min-w-0 max-w-full w-full xl:w-auto flex-col items-center gap-8 animate-fade-in shrink xl:shrink-0">
                <h3 className="w-full text-center text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/55">Event badge layout</h3>
                <VerticalPreviewScaler className="w-full max-w-[304px] mx-auto mt-1">
                  <div className="preview-card-capture">
                    <CardPreview data={previewData} preview isVertical verticalSide={2} />
                  </div>
                </VerticalPreviewScaler>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <Button 
                onClick={() => handleSubmit()} 
                disabled={saving}
                className="rounded-md h-12 min-w-[160px] px-7 font-medium text-sm tracking-[0.01em]"
              >
                {saving ? "Saving Changes..." : "Save"}
              </Button>
            </div>
        </div>

        {canCustomizeBranding ? (
        <div className="w-full max-w-[1040px] mt-8 flex flex-col lg:flex-row gap-8 animate-slide-up bg-white/45 border border-white/20 px-6 py-6 sm:px-8 sm:py-8 rounded-xl glass-panel shadow-md backdrop-blur-xl">

          {/* Item 2: Theme Selection */}
          <div className="relative flex-1 flex flex-col gap-3 items-center lg:items-start">
            <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">Theme color</span>
            <div className="flex gap-2 h-10 items-center">
                {colors.map((c) => (
                  <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setShowCustomColorPicker(false);
                        update("color")(c.name);
                      }}
                      className={`w-8 h-8 rounded-full transition-all duration-150 relative overflow-hidden flex items-center justify-center p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-95 ${
                        !showCustomColorPicker && form.color === c.name 
                            ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-md" 
                            : "hover:scale-110 border border-white/40"
                      }`}
                      style={{ 
                        background: `linear-gradient(135deg, ${c.start}, ${c.end})`,
                        backgroundClip: "border-box",
                      }}
                  >
                      <span className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.2)] pointer-events-none" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={(e) => {
                    setShowTextColorPicker(false);
                    setCustomColorAnchorRect(e.currentTarget.getBoundingClientRect());
                    setDraftCustomColor(isCustomColorSelected ? form.color : "#2563EB");
                    setShowCustomColorPicker(true);
                  }}
                  className={`w-8 h-8 rounded-full transition-all duration-150 relative overflow-hidden flex items-center justify-center p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-95 ${
                    isCustomPickerActive
                      ? "ring-2 ring-primary ring-offset-2 scale-110 shadow-md"
                      : "hover:scale-110 border border-white/40"
                  }`}
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ff4d4f, #ffa940, #fadb14, #73d13d, #36cfc9, #4096ff, #9254de, #f759ab, #ff4d4f)",
                  }}
                  aria-label="Choose custom color"
                  title="Choose custom color"
                >
                  <span
                    className="absolute inset-[3px] rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.18)]"
                    style={{ background: isCustomColorSelected ? form.color : "#ffffff" }}
                  />
                  <span
                    className="relative z-10 text-[14px] font-bold leading-none"
                    style={{ color: isCustomColorSelected ? "#ffffff" : "#2563EB" }}
                  >
                    +
                  </span>
                </button>
                {showCustomColorPicker && (
                  <CustomColorPicker
                    value={draftCustomColor}
                    anchorRect={customColorAnchorRect}
                    onChange={(next) => setDraftCustomColor(next)}
                    onCancel={() => setShowCustomColorPicker(false)}
                    onConfirm={() => {
                      update("color")(draftCustomColor);
                      setShowCustomColorPicker(false);
                    }}
                  />
                )}
            </div>
          </div>

          <div className="w-px bg-white/25 hidden lg:block mx-1" />

          {/* Item 3: Text Color Selection */}
          <div className="relative flex-1 flex flex-col gap-3 items-center justify-center">
            <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">Text color</span>
            <div className="flex h-10 items-center rounded-md border border-border/60 bg-white/85 p-1 shadow-sm">
              <button
                type="button"
                onClick={(e) => {
                  setActiveTextTarget("horizontal");
                  setShowCustomColorPicker(false);
                  setTextColorAnchorRect(e.currentTarget.getBoundingClientRect());
                  setDraftTextColor(horizontalTextColor || "#FFFFFF");
                  setShowTextColorPicker(true);
                }}
                className={`h-8 px-3 text-[12px] font-semibold rounded-sm transition-all ${
                  activeTextTarget === "horizontal"
                    ? "bg-primary/12 text-primary-strong ring-1 ring-primary/30 shadow-sm"
                    : "text-heading/75 hover:bg-slate-100/80"
                }`}
              >
                T1 - Horizontal
              </button>
              <div className="mx-1 h-5 w-px bg-border/70" />
              <button
                type="button"
                onClick={(e) => {
                  setActiveTextTarget("vertical");
                  setShowCustomColorPicker(false);
                  setTextColorAnchorRect(e.currentTarget.getBoundingClientRect());
                  setDraftTextColor(verticalTextColor || "#000000");
                  setShowTextColorPicker(true);
                }}
                className={`h-8 px-3 text-[12px] font-semibold rounded-sm transition-all ${
                  activeTextTarget === "vertical"
                    ? "bg-primary/12 text-primary-strong ring-1 ring-primary/30 shadow-sm"
                    : "text-heading/75 hover:bg-slate-100/80"
                }`}
              >
                T2 - Vertical
              </button>
            </div>
            {showTextColorPicker && (
              <CustomColorPicker
                value={draftTextColor}
                anchorRect={textColorAnchorRect}
                onChange={(next) => setDraftTextColor(next)}
                onCancel={() => setShowTextColorPicker(false)}
                onConfirm={() => {
                  if (activeTextTarget === "horizontal") {
                    setHorizontalTextColor(draftTextColor);
                    setForm((f) => ({ ...f, horizontalTextColor: draftTextColor }));
                  } else {
                    setVerticalTextColor(draftTextColor);
                    setForm((f) => ({ ...f, verticalTextColor: draftTextColor }));
                  }
                  setShowTextColorPicker(false);
                }}
              />
            )}
          </div>

          <div className="w-px bg-white/25 hidden lg:block mx-1" />

          {/* Item 4: Typography Selection */}
          <div className="flex-1 flex flex-col gap-2 max-w-[280px] lg:max-w-none">
            <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">Typography</span>
            <div className="min-h-[44px] w-full lg:max-w-[320px]">
                <CardTypographyPicker
                  value={form.fontFamily}
                  onChange={(val) => update("fontFamily")(val)}
                  buttonClassName="min-h-[48px]"
                />
            </div>
        </div>
      </div>
        ) : (
          <div className="w-full max-w-[1040px] mt-8 animate-slide-up bg-white/45 border border-white/20 px-6 py-6 sm:px-8 sm:py-8 rounded-xl glass-panel shadow-md backdrop-blur-xl">
            <p className="text-sm text-muted text-center lg:text-left">
              Card branding is managed by the event organization. You can update attendee details only.
            </p>
          </div>
        )}
    </div>

    </main>
  );
}
