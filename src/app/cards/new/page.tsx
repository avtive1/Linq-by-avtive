"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker } from "@/components/ui";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("avtive_user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setForm((f) => ({
          ...f,
          email: user.email || f.email,
          linkedin: user.linkedin || f.linkedin,
        }));
      }
    }
  }, []);

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
    const newErrors: Record<string, string> = {};
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const id = Date.now().toString();
    const newCard = {
      id,
      ...form,
      linkedin: extractLinkedInHandle(form.linkedin),
    };
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("avtive_cards");
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem("avtive_cards", JSON.stringify([...existing, newCard]));
      localStorage.setItem(`avtive_card_${id}`, JSON.stringify(newCard));
    }
    router.push(`/cards/${id}`);
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
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors mb-8 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Dashboard
        </Link>

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

          <Button type="submit" variant="primary" fullWidth className="h-12 text-base mt-4 shadow-lg shadow-primary/20">
            Save Card
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