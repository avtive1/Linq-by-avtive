"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker } from "@/components/ui";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { pb } from "@/lib/pocketbase";

export default function NewCardPage() {
  const router = useRouter();
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

  // Prepopulation from auth store removed to ensure manual entry per user request
  /* 
  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      setForm((f) => ({
        ...f,
        email: pb.authStore.model!.email || f.email,
        linkedin: pb.authStore.model!.linkedin || f.linkedin,
      }));
    }
  }, []);
  */

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
      { key: "eventName", label: "Event Name" },
      { key: "sessionDate", label: "Session Date" },
      { key: "location", label: "Location" },
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
      const data = new FormData();
      if (pb.authStore.isValid && pb.authStore.model) {
        data.append('user', pb.authStore.model.id);
      }
      data.append('name', form.name);
      data.append('role', form.role);
      data.append('company', form.company);
      data.append('cardEmail', form.email);
      data.append('eventName', form.eventName);
      data.append('sessionDate', form.sessionDate);
      data.append('location', form.location);
      data.append('track', form.track || "");
      data.append('linkedin', extractLinkedInHandle(form.linkedin));
      data.append('year', form.year);
      
      if (form.photo && form.photo.startsWith('data:')) {
        const res = await fetch(form.photo);
        const blob = await res.blob();
        
        // Prevent generic oversized uploads
        if (blob.size > 5 * 1024 * 1024) {
          alert("Photo is too large! Please use an image under 5MB.");
          setLoading(false);
          return;
        }
        
        data.append('photo', blob, 'photo.jpg');
      }

      const record = await pb.collection('attendees').create(data);
      router.push(`/cards/${record.id}`);
    } catch (err: any) {
       console.error("Error creating card. Server responded with:", err.data || err);
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold text-heading tracking-tight flex items-center gap-2">
              New Card
              <Sparkles size={20} className="text-primary animate-pulse" />
            </h1>
            <p className="text-sm text-muted">Fill in your details to generate your attendee card.</p>
          </div>

          <div className="flex flex-col gap-5">
            {fields.map((f) => (
              f.key === "photo" ? (
                <FilePicker
                  key={f.key}
                  label={f.label}
                  value={form.photo}
                  onChange={update("photo")}
                  error={errors.photo}
                />
              ) : (
                <TextInput
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  type={f.type}
                  placeholder={f.placeholder}
                  icon={f.key === "email" ? "email" : undefined}
                  value={(form as Record<string, string>)[f.key]}
                  onChange={update(f.key)}
                  error={errors[f.key]}
                />
              )
            ))}
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