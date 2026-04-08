"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton } from "@/components/ui";
import { Lock } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function NewCardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId") || "";

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
  });

  // Fetch event details for the locked header / preview.
  const [eventLoading, setEventLoading] = useState(!!eventId);
  const [eventMissing, setEventMissing] = useState(false);

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

  const update = (key: string) => (val: string) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      let photo_url = "";

      // Handle photo upload to Supabase Storage. Validation already happened
      // in FilePicker — by the time we get here the data URL is trusted.
      if (form.photo && form.photo.startsWith('data:')) {
        const res = await fetch(form.photo);
        const blob = await res.blob();

        const ext = blob.type.split("/")[1] || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendee_photos')
          .upload(fileName, blob);

        if (uploadError) {
          toast.error("Failed to upload photo. Check your connection.");
          throw uploadError;
        }
        photo_url = uploadData.path;
      }

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
        event_id: eventId,
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
    } finally {
      setLoading(false);
    }
  };

  if (!eventId) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-[32px] shadow-2xl max-w-sm">
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

  if (eventMissing) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center bg-transparent">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 glass-panel p-10 rounded-[32px] shadow-2xl max-w-sm">
          <p className="text-heading font-semibold">Event not found</p>
          <p className="text-sm text-muted">
            This registration link is no longer valid. Please ask your organizer for a new one.
          </p>
          <Link href="/" className="mt-2">
            <Button variant="secondary">Back to home</Button>
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
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[12px] font-bold tracking-[0.2em] text-muted/40 uppercase">
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
            <div className="flex items-center gap-2 text-sm text-primary-strong bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
              <Lock size={14} />
              Loading event details...
            </div>
          )}
          {!eventLoading && (
            <div className="flex items-center gap-2 text-sm text-primary-strong bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
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
              label="Track (Optional)"
              placeholder="Track"
              value={form.track}
              onChange={update("track")}
            />
            <TextInput
              label="LinkedIn (Optional)"
              placeholder="linkedin.com/in/yourhandle"
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

          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="h-12 text-base mt-4 shadow-lg shadow-primary/20"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Card"}
          </Button>
        </form>
      </div>

      {/* Right Content - Preview with same scale as download screen */}
      <div className="flex-1 flex flex-col items-center py-8 px-4 sm:px-6 lg:h-screen min-h-[500px] lg:min-h-0 overflow-y-auto animate-slide-up delay-100">
        <h2 className="text-xs font-bold tracking-[0.2em] text-muted/40 uppercase mb-6">
          Live Preview
        </h2>

        {/* Same responsive scale wrapper as the download page */}
        <div className="preview-scale-wrapper w-full">
          <div
            className="preview-card-capture"
            style={{ width: "800px", aspectRatio: "800/420" }}
          >
            <CardPreview data={form} preview />
          </div>
        </div>

        <p className="mt-6 text-xs text-muted text-center max-w-xs leading-relaxed">
          Click the card to zoom in. Add a LinkedIn URL to show a scannable QR code.
        </p>
      </div>

      {/* Responsive scale styles — same logic as download page */}
      <style>{`
        .preview-scale-wrapper {
          display: flex;
          justify-content: center;
          overflow: visible;
        }
        .preview-card-capture {
          transform-origin: top center;
        }
        @media (max-width: 1024px) {
          /* On < lg screens, the preview panel is full width */
          .preview-scale-wrapper { overflow: hidden; }
          .preview-card-capture {
            transform: scale(calc((100vw - 48px) / 800));
            margin-bottom: calc((420px * ((100vw - 48px) / 800)) - 420px);
          }
        }
        @media (min-width: 1025px) {
          /* On lg+ screens, preview panel is flex-1. We scale to fit that panel. */
          .preview-scale-wrapper { overflow: hidden; }
          .preview-card-capture {
            transform: scale(calc((100vw - 480px - 48px) / 800));
            margin-bottom: calc((420px * ((100vw - 480px - 48px) / 800)) - 420px);
          }
        }
        @media (min-width: 1600px) {
          /* On very large screens render at natural size */
          .preview-scale-wrapper { overflow: visible; }
          .preview-card-capture {
            transform: scale(1);
            margin-bottom: 0;
          }
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
              <Skeleton className="w-full h-14 rounded-xl" />
              <Skeleton className="w-full h-14 rounded-xl" />
              <Skeleton className="w-full h-14 rounded-xl" />
              <Skeleton className="w-full h-14 rounded-xl" />
              <Skeleton className="w-full h-14 rounded-xl" />
            </div>
            <Skeleton className="w-full h-12 rounded-xl mt-4" />
          </div>
        </div>

        {/* Skeleton Preview */}
        <div className="flex-1 flex flex-col items-center py-8 px-6 lg:h-screen">
          <Skeleton className="w-24 h-4 mb-6" />
          <Skeleton className="w-full max-w-[600px] aspect-[800/420] rounded-2xl shadow-xl" />
          <Skeleton className="w-48 h-4 mt-6" />
        </div>
      </main>
    }>
      <NewCardForm />
    </Suspense>
  );
}
