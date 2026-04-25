"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton, Select } from "@/components/ui";
import { CustomColorPicker } from "@/components/CustomColorPicker";

import { Lock } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";
import { parseEventSponsors } from "@/lib/sponsors";
import type { SponsorEntry } from "@/types/card";

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
    designType: "design1" as "design1",
    color: "purple",
    fontFamily: "inter",
    cardRole: initialRole,
    guestCategory: initialRole === "guest" ? initialGuestCategory : "",
    sponsors: [] as SponsorEntry[],
    organizationName: "",
    organizationLogoUrl: "",
  });


  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");
  const [verticalSide, setVerticalSide] = useState<1 | 2>(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [draftCustomColor, setDraftCustomColor] = useState("#2563EB");
  const [customColorAnchorRect, setCustomColorAnchorRect] = useState<DOMRect | null>(null);


  // Fetch event details for the locked header / preview.
  const [eventLoading, setEventLoading] = useState(!!eventId);
  const [eventMissing, setEventMissing] = useState(false);
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
          setEventMissing(true);
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
            sponsors: parseEventSponsors(brandingPayload.data.sponsors),
            organizationName: String(brandingPayload.data.organizationName || ""),
            organizationLogoUrl: String(brandingPayload.data.organizationLogoUrl || ""),
          }));
        }
      } catch (brandingErr) {
        if (isMounted) setEventMissing(true);
      }
      setEventLoading(false);
    };
    fetchEvent();
    return () => { isMounted = false; };
  }, [eventId]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = () => {
    const newErrors: Record<string, string> = { ...errors };
    const requiredFields = [
      { key: "name", label: "Full Name" },
      { key: "role", label: "Role/Title" },
      { key: "company", label: "Organization" },
      { key: "email", label: "Email" },
    ];

    requiredFields.forEach((field) => {
      if (!form[field.key as keyof typeof form]) {
        newErrors[field.key] = `${field.label} is required`;
      }
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
      let photo_url = "";

      // 1. Handle user photo upload (if any)
      if (form.photo && form.photo.startsWith('data:')) {
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
                console.warn("Preview upload skipped due to folder permission:", reason);
              } else {
                console.warn("Preview upload skipped:", reason);
              }
            }
          }
        } catch (previewErr) {
          console.warn("Preview generation skipped:", previewErr);
        }
      }

      // 3. Save EVERYTHING in one single Insert call
      const attendeeData = {
        user_id: null,
        name: form.name,
        role: form.role,
        company: form.company,
        card_email: form.email,
        event_name: form.eventName,
        session_date: form.sessionDate,
        session_time: form.sessionTime,
        location: form.location,
        linkedin: formatQrLink(form.linkedin),
        year: form.year,
        photo_url: photo_url,
        card_preview_url: card_preview_url,
        event_id: eventId,
        design_type: "design1",
        card_color: form.color,
        track: form.cardRole,
        guest_category: form.cardRole === "guest" ? (form.guestCategory || null) : null,
      };

      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendeeData),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Failed to save card. Please try again.");
        throw new Error(body.error || "Failed to save card");
      }

      toast.success("Attendee card saved successfully!");

      if (body.data?.id) {
        try {
          const { toPng } = await import("html-to-image");
          const cardId = String(body.data.id);
          const uploadVertical = async (node: HTMLDivElement | null, suffix: "vertical-front" | "vertical-back") => {
            if (!node) return;
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
            const uploadPayload = await uploadRes.json();
            if (!uploadRes.ok || !uploadPayload?.data?.url) {
              throw new Error(uploadPayload?.error || `Failed to upload ${suffix} preview.`);
            }
          };
          await uploadVertical(verticalFrontRef.current, "vertical-front");
          await uploadVertical(verticalBackRef.current, "vertical-back");
        } catch (verticalErr) {
          console.warn("Vertical preview upload skipped:", verticalErr);
        }
        const nextUrl = body.shareToken
          ? `/cards/${body.data.id}?share=true&token=${encodeURIComponent(String(body.shareToken))}`
          : `/cards/${body.data.id}?share=true`;
        router.push(nextUrl);
      }
    } catch (err: unknown) {
       const message = err instanceof Error ? err.message : "An unexpected error occurred.";
       console.error("Error creating card:", err);
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
          <Link href="/" className="mt-2">
            <Button variant="secondary">Back to home</Button>
          </Link>
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
          <Link href="/" className="mt-2 w-full">
            <Button variant="secondary" fullWidth>Back to Home</Button>
          </Link>
        </div>
      </main>
    );
  }

  const colors = [
    { name: "purple", start: "#41295a", end: "#2f0743" },
    { name: "red",    start: "#c94b4b", end: "#4b134f" },
    { name: "pink",   start: "#EE0979", end: "#FF6A00" },
    { name: "blue",   start: "#D3CCE3", end: "#E9E4F0" },
  ];
  const presetColorNames = new Set(colors.map((c) => c.name));
  const isCustomColorSelected = !presetColorNames.has(form.color);
  const isCustomPickerActive = showCustomColorPicker || isCustomColorSelected;

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-x-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-8 md:p-12 overflow-y-auto lg:h-screen animate-slide-up">
        <div className="flex items-center gap-4 mb-12">
          <span className="text-sm font-normal tracking-[0.01em] leading-tight text-muted/65">
            Avtive attendee portal
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold text-heading tracking-[-0.03em] leading-[1.1]">
              Event Registration
            </h1>
            <p className="text-base text-muted leading-[1.55]">
              {form.eventName
                ? `Register for ${form.eventName} and get your attendee card.`
                : "Register for the event to generate your attendee card."}
            </p>
          </div>

          {eventLoading && (
            <div className="flex items-center gap-2 text-sm text-primary-strong bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
              <Lock size={14} />
              Loading event details...
            </div>
          )}
          {!eventLoading && (
            <div className="flex items-center gap-2 text-sm text-primary-strong bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
              <Lock size={14} />
              Event details are pre-filled from the organizer.
            </div>
          )}

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
                      <CardPreview data={form} preview isVertical verticalSide={1} />
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
                 {loading ? "Saving..." : "Save"}
               </Button>
             </div>
          </div>
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
              </div>
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
                      <CardPreview data={form} isVertical verticalSide={1} />
                   </div>
                </div>
                <div className="flex flex-col items-center gap-6">
                   <span className="text-[13px] font-medium text-white/50 tracking-[0.01em] leading-tight print:hidden">Back side (QR)</span>
                   <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={form} isVertical verticalSide={2} />
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
