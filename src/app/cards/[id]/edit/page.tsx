"use client";
import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton, Select } from "@/components/ui";
import { ArrowLeft, Lock } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { supabase, getFileUrl as getSupabaseFileUrl } from "@/lib/supabase";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { parseEventSponsors } from "@/lib/sponsors";
import type { SponsorEntry } from "@/types/card";

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
  designType: "design1" | "design2";
  color: string;
  fontFamily: string;
  sponsors: SponsorEntry[];
};

const colors = [
  { name: "purple", start: "#41295a", end: "#2f0743" },
  { name: "red",    start: "#c94b4b", end: "#4b134f" },
  { name: "pink",   start: "#EE0979", end: "#FF6A00" },
  { name: "blue",   start: "#D3CCE3", end: "#E9E4F0" },
];

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const cardRef = useRef<HTMLDivElement>(null);

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
  });
  
  const [originalPhotoPath, setOriginalPhotoPath] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const { data: record, error } = await supabase
          .from("attendees")
          .select("*")
          .eq("id", id)
          .single();
        if (error || !record) {
          if (isMounted) setNotFound(true);
          return;
        }

        // Authorization: only the owner of the parent event can edit.
        if (record.event_id) {
          const { data: ev, error: evErr } = await supabase
            .from("events")
            .select("user_id")
            .eq("id", record.event_id)
            .single();
          if (evErr || !ev || ev.user_id !== session.user.id) {
            if (isMounted) setUnauthorized(true);
            return;
          }
        } else {
          // No parent event — only the original creator (if any) may edit.
          if (record.user_id && record.user_id !== session.user.id) {
            if (isMounted) setUnauthorized(true);
            return;
          }
        }

        if (!isMounted) return;
        setEventId(record.event_id || null);
        setOriginalPhotoPath(record.photo_url || null);

        let sponsors: SponsorEntry[] = [];
        if (record.event_id) {
          const { data: ev } = await supabase
            .from("events")
            .select("sponsors")
            .eq("id", record.event_id)
            .single();
          if (ev) sponsors = parseEventSponsors(ev.sponsors);
        }

        setForm({
          name: record.name || "",
          role: record.role || "",
          company: record.company || "",
          email: record.card_email || "",
          eventName: record.event_name || "",
          sessionDate: record.session_date || "",
          sessionTime: record.session_time || "",
          location: record.location || "",
          track: record.track || "",
          photo: record.photo_url ? getSupabaseFileUrl("attendee_photos", record.photo_url) : "",
          year: record.year || new Date().getFullYear().toString(),
          linkedin: record.linkedin || "",
          designType: (record.design_type as "design1" | "design2") || "design1",
          color: record.card_color || "purple",
          fontFamily: "inter",
          sponsors,
        });
      } catch (err) {
        console.error("Edit load error:", err);
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
        const res = await fetch(form.photo);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("attendee_photos")
          .upload(fileName, blob);
        
        if (uploadError) {
          toast.error("Failed to upload photo.");
          throw uploadError;
        }

        if (originalPhotoPath) {
          await supabase.storage.from("attendee_photos").remove([originalPhotoPath]);
        }
        photo_url = uploadData.path;
      }

      // Generate Social Preview Image for Card updates
      let card_preview_url = "";
      if (cardRef.current) {
        try {
          const dataUrl = await toPng(cardRef.current, {
            quality: 1,
            pixelRatio: 2,
            backgroundColor: "#ffffff",
          });
          if (dataUrl && dataUrl.length > 100) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(2)}.png`;
            const { data: previewData, error: previewUploadError } = await supabase.storage
              .from('card_previews')
              .upload(previewFileName, blob, { contentType: 'image/png' });
            if (!previewUploadError && previewData) {
              card_preview_url = previewData.path;
            }
          }
        } catch (previewErr) {
          console.error("Failed to generate preview image:", previewErr);
        }
      }

      const updatePayload: any = {
        name: form.name,
        role: form.role,
        company: form.company,
        card_email: form.email,
        track: form.track || "",
        linkedin: formatQrLink(form.linkedin),
        photo_url,
        design_type: form.designType,
        card_color: form.color,
      };

      if (card_preview_url) {
        updatePayload.card_preview_url = card_preview_url;
      }

      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to save changes.");
        throw new Error(errorData.error || "Failed to save changes.");
      }

      toast.success("Card updated successfully.");
      router.refresh();
      if (eventId) {
        router.push(`/dashboard/events/${eventId}`);
      } else {
        router.push(`/cards/${id}`);
      }
    } catch (err) {
      console.error("Edit save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-hidden">
        <GradientBackground />
        <div className="relative z-10 w-full lg:w-[460px] glass-panel p-6 md:p-11 lg:h-screen">
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
        <div className="flex-1 flex flex-col items-center py-8 px-6 lg:h-screen">
          <Skeleton className="w-24 h-4 mb-6" />
          <Skeleton className="w-full max-w-[600px] aspect-800/420 rounded-xl shadow-xl" />
          <Skeleton className="w-48 h-4 mt-6" />
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
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
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
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
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-6 md:p-11 overflow-y-auto lg:h-screen animate-slide-up">
        
        <div className="flex items-center gap-3 mb-8 -ml-1 sm:-ml-2">
          <button
            onClick={() => {
              const target = eventId ? `/dashboard/events/${eventId}` : "/dashboard";
              router.refresh();
              router.push(target);
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-inline group bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Event
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-heading tracking-tight leading-tight">
              Edit Card
            </h1>
            <p className="text-base text-muted leading-[1.55]">
              Update the attendee details below.
            </p>
          </div>

          <div className="flex flex-col gap-5">
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
      </div>

      {/* Right Content - Preview */}
      <div className="flex-1 flex flex-col items-center py-8 px-3 sm:px-5 lg:h-screen min-h-[500px] lg:min-h-0 overflow-x-hidden overflow-y-auto animate-slide-up delay-100">

        <div className="w-full flex-1 flex flex-col items-center justify-start px-1 sm:px-2 xl:px-3 pt-7">
            <div className="w-full flex flex-col xl:flex-row gap-7 xl:gap-12 items-center xl:items-start justify-center max-w-[1320px] mx-auto min-h-max">
              {/* Horizontal Card Preview */}
              <div className="flex flex-col items-center gap-8 shrink-0 w-full xl:w-auto">
                  <h3 className="text-xs font-bold tracking-[0.06em] text-muted/55">Social post layout</h3>
                  <div className="horizontal-preview-frame">
                    <div className="preview-card-capture horizontal-preview">
                      <CardPreview data={form} preview />
                    </div>
                  </div>
                    <Button 
                    onClick={() => handleSubmit()} 
                    disabled={saving}
                    className="rounded-md min-w-[240px] px-8 h-11 shadow-2xl shadow-primary/20 hover:-translate-y-1 active:translate-y-0 transition-all font-bold text-sm tracking-wide"
                  >
                    {saving ? "Saving Changes..." : "Save & View"}
                  </Button>
              </div>

              {/* Vertical Card Preview - Only shown if LinkedIn/QR Link is provided */}
              {form.linkedin && (
                  <div className="flex flex-col items-center gap-8 animate-fade-in shrink-0 w-full xl:w-auto">
                    <h3 className="text-xs font-bold tracking-[0.06em] text-muted/55">Event badge layout</h3>
                    <div className="vertical-preview-frame mt-1">
                      <div className="preview-card-capture vertical-preview">
                        <CardPreview data={form} preview isVertical verticalSide={1} />
                      </div>
                    </div>
                    <Button 
                        variant="secondary"
                        onClick={() => setShowPrintPreview(true)} 
                        className="rounded-md min-w-[240px] px-8 h-11 shadow-xl hover:bg-surface hover:-translate-y-1 active:translate-y-0 transition-all text-sm font-bold tracking-wide border-white/20"
                    >
                        Save & View
                    </Button>
                  </div>
              )}
            </div>
        </div>

        {/* Layout/Style Control Panel (identical to app/cards/new) */}
        <div className="w-full max-w-[1040px] mt-6 flex flex-col lg:flex-row gap-4 animate-slide-up bg-white/45 border border-white/20 px-4 py-4 sm:px-5 sm:py-5 rounded-xl glass-panel shadow-md backdrop-blur-xl">
          {/* Item 1: Layout Selection */}
          <div className="flex-1 flex flex-col gap-2.5">
            <span className="text-xs font-semibold tracking-[0.04em] text-muted/65">Layout style</span>
            <div className="flex gap-2 h-10">
                <button
                  type="button"
                  onClick={() => update("designType")("design1")}
                  className={`flex-1 rounded-sm border text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${
                      form.designType === "design1" 
                        ? "bg-primary text-white border-primary shadow-md" 
                        : "bg-white/70 border-border/80 text-heading hover:bg-white hover:border-primary/50"
                  }`}
                >
                  Design 1
                </button>
                <button
                  type="button"
                  onClick={() => update("designType")("design2")}
                  className={`flex-1 rounded-sm border text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97] ${
                      form.designType === "design2" 
                        ? "bg-primary text-white border-primary shadow-md" 
                        : "bg-white/70 border-border/80 text-heading hover:bg-white hover:border-primary/50"
                  }`}
                >
                  Design 2
                </button>
            </div>
          </div>

          <div className="w-px bg-white/25 hidden lg:block mx-1" />

          {/* Item 2: Theme Selection */}
          <div className="flex flex-col gap-2.5 items-center lg:items-start shrink-0">
            <span className="text-xs font-semibold tracking-[0.04em] text-muted/65">Theme color</span>
            <div className="flex gap-2 h-10 items-center">
                {colors.map((c) => (
                  <button
                      key={c.name}
                      type="button"
                      onClick={() => update("color")(c.name)}
                      className={`w-8 h-8 rounded-full transition-all duration-150 relative overflow-hidden flex items-center justify-center p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-95 ${
                        form.color === c.name 
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
            </div>
          </div>

          <div className="w-px bg-white/25 hidden lg:block mx-1" />

          {/* Item 3: Typography Selection */}
          <div className="flex-1 flex flex-col gap-2 max-w-[280px] lg:max-w-none">
            <span className="text-xs font-semibold tracking-[0.04em] text-muted/65">Typography</span>
            <div className="h-11">
                <Select
                  value={form.fontFamily}
                  onChange={(val) => {
                    const updateFn: any = update;
                    updateFn("fontFamily")(val);
                  }}
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
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center p-8 overflow-y-auto animate-fade-in print:bg-white print:p-0 print:block"
            style={{ zIndex: 100 }}
          >
            <div className="w-full max-w-4xl flex justify-between items-center mb-12 print:hidden">
                <h2 className="text-xl font-bold text-white tracking-tight">Print Ready Badge</h2>
                <div className="flex gap-4">
                  <Button variant="secondary" onClick={() => setShowPrintPreview(false)}>Close Overlay</Button>
                  <Button onClick={() => window.print()}>Print Card Now</Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-12 print:flex-col print:gap-20 print:items-center">
                <div className="flex flex-col items-center gap-6">
                  <span className="text-xs font-semibold text-white/50 tracking-[0.04em] print:hidden">Front side (Photo)</span>
                  <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={form} isVertical verticalSide={1} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-6">
                  <span className="text-xs font-semibold text-white/50 tracking-[0.04em] print:hidden">Back side (QR)</span>
                  <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={form} isVertical verticalSide={2} />
                  </div>
                </div>
            </div>

            <div className="mt-24 p-8 border border-white/10 rounded-xl bg-white/5 max-w-lg text-center print:hidden">
                <p className="text-sm text-white/60 mb-4 leading-relaxed">
                  For the best experience, use heavy cardstock and set your printer to <b>Portrait</b> with <b>Default</b> margins.
                </p>
                <p className="text-xs font-semibold text-primary tracking-[0.04em]">Fold along the center after printing</p>
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
          .glass-panel, button, h3, p, .fixed > div:not(.flex) { display: none !important; }
          .fixed { position: relative !important; background: white !important; display: block !important; p-0 !important; }
          @page { margin: 1cm; size: auto; }
        }
      `}</style>
    </main>
  );
}
