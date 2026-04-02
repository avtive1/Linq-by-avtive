"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Select } from "@/components/ui";
import { ArrowLeft, Sparkles, Lock } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { supabase } from "@/lib/supabase";

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

  // Fetch all events for the dropdown
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from("events").select("*").order("name");
      if (error) {
        console.error("Could not fetch events list:", error);
      } else {
        setAvailableEvents(data || []);
      }
    };
    fetchEvents();
  }, []);

  // If an eventId is present, fetch event details and pre-fill the form
  const [eventLocked, setEventLocked] = useState(false);
  const [eventLoading, setEventLoading] = useState(!!eventId);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      setEventLoading(true);
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) {
        console.error("Could not fetch event:", error);
      } else if (data) {
        setForm((f) => ({
          ...f,
          eventName: data.name || "",
          location: data.location || "",
          sessionDate: data.date || "",
        }));
        setEventLocked(true);
      }
      setEventLoading(false);
    };
    fetchEvent();
  }, [eventId]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    
    // Auto-fill logic when selecting an event from dropdown
    if (key === "eventName") {
      const selectedEvent = availableEvents.find(e => e.id === val || e.name === val);
      if (selectedEvent) {
        setForm(f => ({
          ...f,
          eventName: selectedEvent.name,
          sessionDate: selectedEvent.date || "",
          location: selectedEvent.location || "",
        }));
        setEventLocked(true);
      } else {
        setEventLocked(false);
      }
    }

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
      { key: "eventName", label: "Event Name" },
      { key: "sessionDate", label: "Session Date" },
      { key: "location", label: "Location" },
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
      const { data: { session } } = await supabase.auth.getSession();
      
      let photo_url = "";
      
      // Handle Photo Upload to Supabase Storage
      if (form.photo && form.photo.startsWith('data:')) {
        const res = await fetch(form.photo);
        const blob = await res.blob();
        
        if (blob.size > 5 * 1024 * 1024) {
          alert("Photo is too large! Please use an image under 5MB.");
          setLoading(false);
          return;
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attendee_photos')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;
        photo_url = uploadData.path;
      }

      const attendeeData = {
        user_id: session?.user?.id || null,
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
        event_id: eventId || null
      };
      
      const { data: record, error: insertError } = await supabase
        .from('attendees')
        .insert(attendeeData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Navigate back to the event page if we came from one, otherwise to the card view
      if (eventId) {
        router.push(`/dashboard/events/${eventId}`);
      } else if (record) {
        router.push(`/cards/${record.id}`);
      }
    } catch (err: any) {
       console.error("Error creating card:", err);
       alert("Failed to save card: " + (err.message || "Check your connection"));
    } finally {
      setLoading(false);
    }
  };


  const fields: Array<{ key: string; label: string; placeholder: string; required?: boolean; icon?: string; type?: string }> = [
    { key: "name", label: "Full Name", placeholder: "Full Name", required: true },
    { key: "role", label: "Role/Title", placeholder: "Role/Title", required: true },
    { key: "company", label: "Organization", placeholder: "Organization", required: true },
    { key: "email", label: "Email", placeholder: "hello@alignui.com", required: true, icon: "email" },
    { key: "eventName", label: "Event Name", placeholder: "Event Name", required: true },
    { key: "sessionDate", label: "Session Date", placeholder: "Session Date", required: true, type: "date" },
    { key: "location", label: "Location", placeholder: "Location", required: true },
    { key: "track", label: "Track (Optional)", placeholder: "Track" },
    { key: "linkedin", label: "LinkedIn (Optional)", placeholder: "linkedin.com/in/yourhandle" },
    { key: "photo", label: "Photo (Optional)", placeholder: "Choose File" },
  ];

  return (
    <main className="relative min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-x-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full lg:w-[480px] bg-white/80 backdrop-blur-xl border-r border-border p-6 md:p-12 overflow-y-auto lg:h-screen">
        <div className="flex items-center gap-3 mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Home
          </Link>
          <span className="text-muted/20">/</span>
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors group"
          >
            Dashboard
          </Link>
          {eventId && (
            <>
              <span className="text-muted/20">/</span>
              <Link 
                href={`/dashboard/events/${eventId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors"
              >
                Event
              </Link>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold text-heading tracking-tight flex items-center gap-2">
              New Card
              <Sparkles size={20} className="text-primary animate-pulse" />
            </h1>
            <p className="text-sm text-muted">Fill in your details to generate your attendee card.</p>
          </div>

          {eventLoading && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <Lock size={14} />
              Loading event details...
            </div>
          )}
          {eventLocked && !eventLoading && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <Lock size={14} />
              Event fields are pre-filled and locked.
            </div>
          )}
          <div className="flex flex-col gap-5">
            {fields.map((f) => {
              const isEventField = ["sessionDate", "location"].includes(f.key);
              const isLockedField = eventLocked && (isEventField || f.key === "eventName");
              
              // Hide date/location if no event is selected (and not locked by URL)
              if (isEventField && !form.eventName && !eventId) return null;

              if (f.key === "photo") {
                return (
                  <FilePicker
                    key={f.key}
                    label={f.label}
                    value={form.photo}
                    onChange={update("photo")}
                    error={errors.photo}
                  />
                );
              }

              if (f.key === "eventName" && !eventId) {
                return (
                  <Select
                    key={f.key}
                    label={f.label}
                    required={f.required}
                    options={availableEvents.map(e => ({ value: e.id, label: e.name }))}
                    value={availableEvents.find(e => e.name === form.eventName)?.id || ""}
                    onChange={update("eventName")}
                    error={errors.eventName}
                    placeholder="Select an Event"
                  />
                );
              }

              return (
                <div key={f.key} className={isLockedField ? "opacity-60 pointer-events-none" : ""}>
                  <TextInput
                    label={isLockedField ? `${f.label} 🔒` : f.label}
                    required={f.required}
                    type={f.type}
                    placeholder={f.placeholder}
                    icon={f.key === "email" ? "email" : undefined}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={update(f.key)}
                    error={errors[f.key]}
                  />
                </div>
              );
            })}
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
      <div className="flex-1 flex flex-col items-center py-8 px-4 sm:px-6 bg-surface/30 lg:h-screen min-h-[500px] lg:min-h-0 overflow-y-auto">
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
      <main className="relative min-h-screen w-full bg-white flex items-center justify-center">
        <GradientBackground />
        <div className="relative z-10 text-muted">Loading...</div>
      </main>
    }>
      <NewCardForm />
    </Suspense>
  );
}
