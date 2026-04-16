"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton, Select } from "@/components/ui";

import { Lock } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { supabase } from "@/lib/supabase";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { getEventStatus } from "@/lib/utils";

function NewCardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "";
  const cardRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    eventName: "",
    sessionDate: "",
    location: "",
    track: "",
    photo: "",
    year: new Date().getFullYear().toString(),
    linkedin: "",
    designType: "design1" as "design1" | "design2",
    color: "purple",
    fontFamily: "inter",
  });


  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">("horizontal");
  const [verticalSide, setVerticalSide] = useState<1 | 2>(1);
  const [showPrintPreview, setShowPrintPreview] = useState(false);


  // Fetch event details for the locked header / preview.
  const [eventLoading, setEventLoading] = useState(!!eventId);
  const [eventMissing, setEventMissing] = useState(false);
  const [eventPast, setEventPast] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    const fetchEvent = async () => {
      setEventLoading(true);
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (!isMounted) return;

      if (error || !data) {
        setEventMissing(true);
      } else {
        const status = getEventStatus(data.date);
        if (status.label === "Past") {
          setEventPast(true);
        }

        setForm((f) => ({
          ...f,
          eventName: data.name || "",
          location: data.location || "",
          sessionDate: data.date || "",
        }));
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
      if (!(form as any)[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const extractLinkedInHandle = (val: string) => {
    if (!val) return "";
    return val
      .replace(/https?:\/\//, "")
      .replace(/www\.linkedin\.com\/in\//, "")
      .replace(/\/$/, "")
      .split("/")[0];
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!validate()) return;
    setLoading(true);

    try {
      let photo_url = "";

      // 1. Handle user photo upload (if any)
      if (form.photo && form.photo.startsWith('data:')) {
        const res = await fetch(form.photo);
        const blob = await res.blob();
        const ext = blob.type.split("/")[1] || "jpg";
        const fileName = `photo-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendee_photos')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;
        photo_url = uploadData.path;
      }

      // 2. Generate and Upload Social Preview Image BEFORE saving to DB
      let card_preview_url = "";
      if (cardRef.current) {
        try {
          console.log("Generating social preview image...");
          const dataUrl = await toPng(cardRef.current, {
            quality: 1,
            pixelRatio: 2, // 2x for high resolution
            backgroundColor: "#ffffff",
          });

          if (dataUrl && dataUrl.length > 100) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            // Generate a unique name for the preview
            const previewFileName = `preview-${Date.now()}-${Math.random().toString(36).substring(2)}.png`;
            
            const { data: previewData, error: previewUploadError } = await supabase.storage
              .from('card_previews')
              .upload(previewFileName, blob, { contentType: 'image/png' });

            if (!previewUploadError && previewData) {
              card_preview_url = previewData.path;
              console.log("Social preview uploaded:", card_preview_url);
            } else {
              console.error("Preview upload failed:", previewUploadError);
            }
          }
        } catch (previewErr) {
          console.error("Failed to generate preview image:", previewErr);
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
        location: form.location,
        track: form.track || "",
        linkedin: extractLinkedInHandle(form.linkedin),
        year: form.year,
        photo_url: photo_url,
        card_preview_url: card_preview_url,
        event_id: eventId,
        design_type: form.designType,
        card_color: form.color,
      };

      const { data: record, error: insertError } = await supabase
        .from('attendees')
        .insert(attendeeData)
        .select()
        .single();

      if (insertError) {
        toast.error("Failed to save card. Please try again.");
        throw insertError;
      }

      toast.success("Attendee card saved successfully!");

      if (record) {
        router.push(`/cards/${record.id}?share=true`);
      }
    } catch (err: any) {
       console.error("Error creating card:", err);
       toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!eventId) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-[12px] shadow-2xl max-w-sm">
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
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-6 glass-panel p-12 rounded-[12px] shadow-2xl max-w-md border border-amber-500/20">
          <div className="w-16 h-16 rounded-[10px] bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Lock size={32} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-heading tracking-tight">Registration Expired</h2>
            <p className="text-sm text-muted leading-relaxed">
              We&apos;re sorry, but the registration for <span className="font-bold text-heading">{form.eventName}</span> has ended as the event date has passed.
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

  return (
    <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-x-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-6 md:p-11 overflow-y-auto lg:h-screen animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[16px] font-bold tracking-[0.2em] text-muted/50 uppercase">
            AVTIVE ATTENDEE PORTAL
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold text-heading tracking-tight">
              Event Registration
            </h1>
            <p className="text-sm text-muted">
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

          {/* Removed main Save Card button as per request */}

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
      <div className="flex-1 flex flex-col items-center py-8 px-4 sm:px-6 lg:h-screen min-h-[500px] lg:min-h-0 overflow-y-auto animate-slide-up delay-100">


        <div className="w-full flex-1 flex flex-col items-center justify-center p-4">
           <div className={`w-full grid grid-cols-1 ${form.linkedin ? 'xl:grid-cols-2' : ''} gap-12 items-start justify-center max-w-[1400px]`}>
              {/* Horizontal Card Preview */}
              <div className="flex flex-col items-center gap-6">
                 <h3 className="text-[10px] font-black tracking-[0.3em] text-muted/30 uppercase">Social Post Layout</h3>
                 <div className="preview-card-capture horizontal-preview">
                    <CardPreview data={form} preview />
                 </div>
                 <Button 
                    onClick={() => handleSubmit()} 
                    disabled={loading}
                    className="rounded-full px-12 h-12 shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                 >
                    {loading ? "Preparing..." : "View & Share Horizontal Card"}
                 </Button>
              </div>

              {/* Vertical Card Preview - Only shown if LinkedIn/QR Link is provided */}
              {form.linkedin && (
                 <div className="flex flex-col items-center gap-6 animate-fade-in">
                    <h3 className="text-[10px] font-black tracking-[0.3em] text-muted/30 uppercase">Event Badge Layout</h3>
                    <div className="preview-card-capture vertical-preview">
                       <CardPreview data={form} preview isVertical verticalSide={1} />
                    </div>
                    <Button 
                       variant="secondary"
                       onClick={() => setShowPrintPreview(true)} 
                       className="rounded-full px-12 h-12 shadow-xl hover:bg-surface transition-all"
                    >
                       View & Print Vertical Badge
                    </Button>
                 </div>
              )}
           </div>
        </div>



        {/* Customization Toolbar - Moved Below Image */}
        <div className="w-full max-w-[800px] mt-8 flex flex-col gap-6 animate-slide-up">
           {/* Row 1: Layout Selection */}
           <div className="glass-panel !bg-white/40 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
              <span className="text-[10px] font-extrabold tracking-[0.2em] text-muted/60 uppercase text-center">Select Card Layout</span>
              <div className="flex gap-4">
                 <button
                    type="button"
                    onClick={() => update("designType")("design1")}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                       form.designType === "design1" 
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                          : "bg-white/40 border-white/20 text-muted hover:bg-white/60"
                    }`}
                 >
                    Design 1 (Standard)
                 </button>
                 <button
                    type="button"
                    onClick={() => update("designType")("design2")}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                       form.designType === "design2" 
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                          : "bg-white/40 border-white/20 text-muted hover:bg-white/60"
                    }`}
                 >
                    Design 2 (Modern)
                 </button>
              </div>
           </div>

           {/* Row 2: Theme Selection */}
           <div className="glass-panel !bg-white/40 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-3">
              <span className="text-[10px] font-extrabold tracking-[0.2em] text-muted/60 uppercase">Pick Your Theme color</span>
              <div className="flex gap-5">
                 {colors.map((c) => (
                    <button
                       key={c.name}
                       type="button"
                       onClick={() => update("color")(c.name)}
                       className={`w-10 h-10 rounded-full transition-all duration-300 relative overflow-hidden flex items-center justify-center p-0 ${
                          form.color === c.name 
                             ? "ring-4 ring-primary ring-offset-4 scale-110 shadow-xl" 
                             : "hover:scale-110 border-2 border-white/40"
                       }`}
                       style={{ 
                          background: `linear-gradient(135deg, ${c.start}, ${c.end})`,
                          backgroundClip: "border-box",
                       }}
                    >
                       <span className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)] pointer-events-none" />
                    </button>
                 ))}
              </div>
           </div>

           {/* Row 3: Typography Selection */}
           <div className="glass-panel !bg-white/40 border border-white/10 p-4 rounded-2xl flex flex-col gap-3">
              <span className="text-[10px] font-extrabold tracking-[0.2em] text-muted/60 uppercase text-center">Customize Font Style</span>
              <Select
                 value={form.fontFamily}
                 onChange={(val) => {
                   const updateFn: any = update;
                   updateFn("fontFamily")(val);
                 }}
                 options={[
                    { label: "Inter (Default)", value: "inter" },
                    { label: "Poppins", value: "poppins" },
                    { label: "Google Sans (Premium)", value: "outfit" },
                    { label: "Times New Roman", value: "times" },
                 ]}
              />
           </div>


        </div>


        {/* Print Preview Overlay */}
        {showPrintPreview && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center p-8 overflow-y-auto animate-fade-in print:bg-white print:p-0 print:block">
             <div className="w-full max-w-4xl flex justify-between items-center mb-12 print:hidden">
                <h2 className="text-xl font-bold text-white tracking-tight">Print Ready Badge</h2>
                <div className="flex gap-4">
                   <Button variant="secondary" onClick={() => setShowPrintPreview(false)}>Close Overlay</Button>
                   <Button onClick={() => window.print()}>Print Card Now</Button>
                </div>
             </div>

             <div className="flex flex-col lg:flex-row gap-12 print:flex-col print:gap-20 print:items-center">
                <div className="flex flex-col items-center gap-6">
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest print:hidden">Front Side (Photo)</span>
                   <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={form} isVertical verticalSide={1} />
                   </div>
                </div>
                <div className="flex flex-col items-center gap-6">
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest print:hidden">Back Side (QR)</span>
                   <div style={{ width: "576px", height: "1024px", transform: "scale(0.5)", transformOrigin: "top center", marginBottom: "-512px" }} className="shadow-2xl print:transform-none print:m-0">
                      <CardPreview data={form} isVertical verticalSide={2} />
                   </div>
                </div>
             </div>

             <div className="mt-24 p-8 border border-white/10 rounded-2xl bg-white/5 max-w-lg text-center print:hidden">
                <p className="text-sm text-white/60 mb-4 leading-relaxed">
                  For the best experience, use heavy cardstock and set your printer to <b>Portrait</b> with <b>Default</b> margins.
                </p>
                <p className="text-[10px] font-bold text-primary tracking-widest uppercase">Fold along the center after printing</p>
             </div>
          </div>
        )}

      </div>

      {/* Responsive scale styles */}
      <style>{`
        .horizontal-preview {
          transform-origin: top center;
          transform: scale(0.4);
          width: 1200px;
          height: 628px;
          margin-bottom: -376px;
        }
        .vertical-preview {
          transform-origin: top center;
          transform: scale(0.4);
          width: 576px;
          height: 1024px;
          margin-bottom: -614px;
        }
        @media (max-width: 1024px) {
          .horizontal-preview { transform: scale(calc((100vw - 48px) / 1200)); margin-bottom: calc((628px * ((100vw - 48px) / 1200)) - 628px); }
          .vertical-preview { transform: scale(calc((100vw - 48px) / 576)); margin-bottom: calc((1024px * ((100vw - 48px) / 576)) - 1024px); }
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

// Default export wraps the form in Suspense (required for useSearchParams)
export default function NewCardPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen w-full bg-transparent flex flex-col lg:flex-row overflow-Hidden">
        <GradientBackground />

        {/* Skeleton Sidebar */}
        <div className="relative z-10 w-full lg:w-[460px] glass-panel p-6 md:p-11 lg:h-screen">
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
          <Skeleton className="w-full max-w-[600px] aspect-[800/420] rounded-xl shadow-xl" />
          <Skeleton className="w-48 h-4 mt-6" />
        </div>
      </main>
    }>
      <NewCardForm />
    </Suspense>
  );
}
