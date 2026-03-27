"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button } from "@/components/ui";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";

export default function NewCardPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    role: "",
    company: "",
    email: "",
    location: "",
    eventName: "",
    sessionDate: "",
    year: "",
    linkedin: "",
  });

  const update = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Date.now().toString();
    const newCard = {
      id,
      eventName: form.eventName,
      year: form.year || new Date().getFullYear().toString(),
      location: form.location,
      ...form,
    };
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("avtive_cards");
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem("avtive_cards", JSON.stringify([...existing, newCard]));
      localStorage.setItem(`avtive_card_${id}`, JSON.stringify(newCard));
    }
    router.push(`/cards/${id}`);
  };

  const fields: { key: string; label: string; placeholder: string; required?: boolean; icon?: any }[] = [
    { key: "name", label: "Full Name", placeholder: "Your Name", required: true },
    { key: "role", label: "Job Title", placeholder: "Your Role", required: true },
    { key: "company", label: "Company", placeholder: "Your Company" },
    { key: "email", label: "Email Address", placeholder: "you@example.com", required: true, icon: "email" },
    { key: "location", label: "Location", placeholder: "City, Country", required: true },
    { key: "eventName", label: "Event Name", placeholder: "e.g. Web Summit", required: true },
    { key: "sessionDate", label: "Session Date", placeholder: "e.g. March 2026" },
    { key: "year", label: "Year", placeholder: "2026" },
    { key: "linkedin", label: "LinkedIn Handle", placeholder: "yourhandle" },
  ];

  return (
    <main className="relative min-h-screen w-full bg-white flex flex-col md:flex-row overflow-hidden">
      <GradientBackground />

      {/* Left Sidebar - Form */}
      <div className="relative z-10 w-full md:w-[480px] min-h-screen bg-white/80 backdrop-blur-xl border-r border-border p-8 md:p-12 overflow-y-auto">
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
              <TextInput
                key={f.key}
                label={f.label}
                required={f.required}
                placeholder={f.placeholder}
                icon={f.key === "email" ? "email" : undefined}
                value={(form as Record<string, string>)[f.key]}
                onChange={update(f.key)}
              />
            ))}
          </div>

          <Button type="submit" variant="primary" fullWidth className="h-12 text-base mt-4 shadow-lg shadow-primary/20">
            Generate Card
          </Button>
        </form>
      </div>

      {/* Right Content - Preview */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface/30">
        <h2 className="text-xs font-bold tracking-[0.2em] text-muted/40 uppercase mb-8">
          Live Preview
        </h2>
        <CardPreview data={form} preview />
        <p className="mt-8 text-xs text-muted text-center max-w-xs leading-relaxed">
          Your card will be generated in 1080x1080 format, perfect for LinkedIn, Twitter, and other social platforms.
        </p>
      </div>
    </main>
  );
}