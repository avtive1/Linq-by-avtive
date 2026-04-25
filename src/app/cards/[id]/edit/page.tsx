"use client";
import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton, Select } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { CustomColorPicker } from "@/components/CustomColorPicker";
import { toast } from "sonner";
import { parseEventSponsors } from "@/lib/sponsors";
import type { SponsorEntry } from "@/types/card";
import { logSecurityEvent } from "@/lib/security/telemetry";
import { isValidUuid } from "@/lib/validation/uuid";

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

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
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
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [draftCustomColor, setDraftCustomColor] = useState("#2563EB");
  const [customColorAnchorRect, setCustomColorAnchorRect] = useState<DOMRect | null>(null);
  const isCustomColorSelected = !presetColorNames.has(form.color);
  const isCustomPickerActive = showCustomColorPicker || isCustomColorSelected;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!isValidUuid(id)) {
          if (isMounted) setNotFound(true);
          return;
        }
        const authRes = await fetch("/api/auth/me");
        const authPayload = await authRes.json();
        const userId = authPayload?.data?.userId ? String(authPayload.data.userId) : "";
        if (!isMounted) return;
        if (!userId) {
          router.replace("/login");
          return;
        }

        const resp = await fetch(`/api/cards/${id}`, { method: "GET" });
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

        if (!isMounted) return;
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
          fontFamily: "inter",
          sponsors,
          organizationName,
          organizationLogoUrl,
        });
      } catch {
        toast.error("Failed to load card.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [id, router]);

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
        const uploadPayload = await uploadRes.json();
        if (!uploadRes.ok || !uploadPayload?.data?.url) {
          toast.error("Failed to upload photo.");
          throw new Error(uploadPayload?.error || "Photo upload failed.");
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
        photo_url = String(uploadPayload.data.url);
      }

      const updatePayload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        company: form.company,
        card_email: form.email,
        track: form.track || "",
        linkedin: formatQrLink(form.linkedin),
        photo_url,
        design_type: "design1",
        card_color: form.color,
      };

      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        logSecurityEvent({
          event: "security.attendees.update_failed",
          level: "error",
          resourceId: id,
          details: { reason: errorData.error },
        });
        toast.error(errorData.error || "Failed to save changes.");
        throw new Error(errorData.error || "Failed to save changes.");
      }

      toast.success("Card updated successfully.");
      try {
        const { toPng } = await import("html-to-image");
        if (!eventId) {
          // Vertical preview upload requires event-scoped folder authorization.
          router.refresh();
          router.push(`/cards/${id}`);
          return;
        }
        const uploadPreview = async (
          node: HTMLDivElement | null,
          suffix: "horizontal" | "vertical-front" | "vertical-back",
        ) => {
          if (!node) return;
          try {
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
            console.warn(`Preview generation/upload skipped (${suffix}):`, verticalCaptureErr);
          }
        };
        const horizontalUrl = await uploadPreview(cardRef.current, "horizontal");
        await uploadPreview(verticalFrontRef.current, "vertical-front");
        await uploadPreview(verticalBackRef.current, "vertical-back");
        if (horizontalUrl) {
          await fetch(`/api/cards/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ card_preview_url: horizontalUrl }),
          });
        }
      } catch (verticalErr) {
        console.warn("Preview upload skipped:", verticalErr);
      }
      router.refresh();
      router.push(`/cards/${id}`);
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
          <Link href="/dashboard" className="mt-2">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
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
          <Link href="/dashboard" className="mt-2">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
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
            onClick={() => {
              const target = eventId ? `/dashboard/events/${eventId}` : "/dashboard";
              router.refresh();
              router.push(target);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline group bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
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
          </div>

          <div className="flex flex-col gap-8">
            <TextInput
              label="Full Name"
              required
              placeholder="Full Name"
              value={form.name}
              error={errors.name}
              onChange={update("name")}
            />
            <TextInput
              label="Role/Title"
              required
              placeholder="Role/Title"
              value={form.role}
              error={errors.role}
              onChange={update("role")}
            />
            <TextInput
              label="Organization"
              required
              placeholder="Organization"
              value={form.company}
              error={errors.company}
              onChange={update("company")}
            />
            <TextInput
              label="Email"
              required
              icon="email"
              placeholder="hello@example.com"
              value={form.email}
              error={errors.email}
              onChange={update("email")}
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
              cropTitle="Crop photo"
              cropSubtitle="Drag the corners or edges to adjust the crop."
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
          <CardPreview data={form} />
        </div>
        <div ref={verticalFrontRef} style={{ width: '576px', height: '1024px' }}>
          <CardPreview data={form} isVertical verticalSide={1} />
        </div>
        <div ref={verticalBackRef} style={{ width: '576px', height: '1024px' }}>
          <CardPreview data={form} isVertical verticalSide={2} />
        </div>
      </div>

      {/* Right Content - Preview */}
      <div className="flex-1 flex flex-col items-center py-12 px-6 sm:px-8 lg:px-12 lg:h-screen min-h-[500px] lg:min-h-0 overflow-x-hidden overflow-y-auto animate-slide-up delay-100">

        <div className="w-full flex-1 flex flex-col items-center justify-start px-4 sm:px-6 xl:px-8 pt-8">
            <div className="w-full flex flex-col xl:flex-row gap-8 xl:gap-12 items-center xl:items-start justify-center max-w-[1320px] mx-auto min-h-max">
              {/* Horizontal Card Preview */}
              <div className="flex flex-col items-center gap-8 shrink-0 w-full xl:w-auto">
                  <h3 className="text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/55">Social post layout</h3>
                  <div className="horizontal-preview-frame">
                    <div className="preview-card-capture horizontal-preview">
                      <CardPreview data={form} preview />
                    </div>
                  </div>
              </div>

              <div className="flex flex-col items-center gap-8 animate-fade-in shrink-0 w-full xl:w-auto">
                <h3 className="text-[13px] font-medium tracking-[0.01em] leading-tight text-muted/55">Event badge layout</h3>
                <div className="vertical-preview-frame mt-1">
                  <div className="preview-card-capture vertical-preview">
                    <CardPreview data={form} preview isVertical verticalSide={2} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-4">
              <Button 
                onClick={() => setShowPrintPreview(true)} 
                variant="secondary"
                className="rounded-md h-12 min-w-[160px] px-7 shadow-sm hover:-translate-y-1 active:translate-y-0 transition-all font-medium text-sm tracking-[0.01em]"
              >
                Print Badge
              </Button>
              <Button 
                onClick={() => handleSubmit()} 
                disabled={saving}
                className="rounded-md h-12 min-w-[160px] px-7 shadow-2xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all font-medium text-sm tracking-[0.01em]"
              >
                {saving ? "Saving Changes..." : "Save"}
              </Button>
            </div>
        </div>

        {/* Layout/Style Control Panel (identical to app/cards/new) */}
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

          {/* Item 3: Typography Selection */}
          <div className="flex-1 flex flex-col gap-2 max-w-[280px] lg:max-w-none">
            <span className="text-[13px] font-normal tracking-[0.01em] leading-tight text-muted/65">Typography</span>
            <div className="h-11">
                <Select
                  value={form.fontFamily}
                    onChange={(val) => update("fontFamily")(val)}
                  options={[
                      { label: "Inter (Default)", value: "inter" },
                      { label: "Poppins", value: "poppins" },
                      { label: "Google Sans", value: "outfit" },
                      { label: "Times New Roman", value: "times" },
                  ]}
                />
          </div>
        </div>
      </div>
    </div>

      {/* Print Preview Overlay */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center p-8 overflow-y-auto animate-fade-in z-[100]">
          <div className="w-full max-w-4xl flex justify-between items-center mb-12">
            <h2 className="text-xl font-semibold text-white tracking-[-0.03em] leading-[1.15]">Print Ready Badge</h2>
            <div className="flex gap-4">
              <Button variant="secondary" onClick={() => setShowPrintPreview(false)}>Close Overlay</Button>
              <Button onClick={() => {
                const printFrame = document.createElement('iframe');
                printFrame.style.position = 'fixed';
                printFrame.style.width = '0';
                printFrame.style.height = '0';
                printFrame.style.border = '0';
                document.body.appendChild(printFrame);

                const frontHtml = verticalFrontRef.current?.innerHTML || "";
                const backHtml = verticalBackRef.current?.innerHTML || "";
                
                const doc = printFrame.contentWindow?.document;
                if (!doc) return;

                // Copy all stylesheets from main document
                const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                  .map(s => s.outerHTML)
                  .join('\n');

                doc.open();
                doc.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Attendee Badge</title>
                      ${styles}
                      <style>
                        @page { margin: 0; size: A4 portrait; }
                        body { margin: 0 !important; padding: 1cm !important; background: white !important; display: flex; justify-content: center; }
                        .print-container { width: 762px; height: 666px; position: relative; }
                        .scale-wrapper { transform: scale(0.65); transform-origin: top left; display: flex; gap: 20px; }
                        .card { width: 576px; height: 1024px; position: relative; overflow: hidden; background: white; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                      </style>
                    </head>
                    <body>
                      <div class="print-container">
                        <div class="scale-wrapper">
                          <div class="card">${frontHtml}</div>
                          <div class="card">${backHtml}</div>
                        </div>
                      </div>
                      <script>
                        function startPrint() {
                          window.focus();
                          window.print();
                          setTimeout(() => { window.frameElement.remove(); }, 500);
                        }
                        // Use a slightly longer timeout to ensure fonts and QR codes are fully rendered
                        window.onload = () => setTimeout(startPrint, 800);
                      </script>
                    </body>
                  </html>
                `);
                doc.close();
              }}>Print Card Now</Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex flex-col items-center gap-6">
              <span className="text-[13px] font-medium text-white/50 tracking-[0.01em] leading-tight">Front side (Photo)</span>
              <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl">
                <CardPreview data={form} isVertical verticalSide={1} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-6">
              <span className="text-[13px] font-medium text-white/50 tracking-[0.01em] leading-tight">Back side (QR)</span>
              <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl">
                <CardPreview data={form} isVertical verticalSide={2} />
              </div>
            </div>
          </div>

          <div className="mt-24 p-8 border border-white/10 rounded-xl bg-white/5 max-w-lg text-center">
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              For the best experience, use heavy cardstock and set your printer to <b>Portrait</b> with <b>Default</b> margins.
            </p>
            <p className="text-[13px] font-medium text-primary tracking-[0.01em] leading-tight">Fold along the center after printing</p>
          </div>
        </div>
      )}

      {/* Responsive scale styles */}
      <style>{`
        .horizontal-preview-frame {
          width: 780px;
          height: 408px;
          display: flex;
          justify-content: center;
          overflow: hidden;
        }
        .horizontal-preview {
          transform-origin: top center;
          transform: scale(0.65);
          width: 1200px;
          height: 628px;
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
            width: min(100%, 780px);
            height: calc(min(100%, 780px) * 0.5233);
          }
          .horizontal-preview {
            transform: scale(calc(min(0.65, (100vw - 56px) / 1200)));
          }
          .vertical-preview-frame {
            width: 272px;
            height: 480px;
          }
          .vertical-preview {
            transform: scale(0.468);
          }
        }
      `}</style>
    </main>
  );
}
