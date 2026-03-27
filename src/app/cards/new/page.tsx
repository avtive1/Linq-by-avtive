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

  const fields = [
    { key: "name", label: "Full Name", placeholder: "Full Name", required: true },
    { key: "role", label: "Role/Title", placeholder: "Role/Title", required: true },
    { key: "company", label: "Organization", placeholder: "Organization", required: true },
    { key: "email", label: "Email", placeholder: "hello@alignui.com", required: true, icon: "email" },
    { key: "eventName", label: "Event Name", placeholder: "Event Name", required: true },
    { key: "sessionDate", label: "Session Date", placeholder: "Session Date", required: true },
    { key: "location", label: "Location", placeholder: "Location", required: true },
    { key: "track", label: "Track (Optional)", placeholder: "Track" },
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

      {/* Right Content - Preview */}
      <div className="flex-1 flex flex-col items-center p-6 md:p-8 md:pt-20 bg-surface/30 lg:h-screen min-h-[700px] lg:min-h-0 overflow-y-auto">
        <h2 className="text-xs font-bold tracking-[0.2em] text-muted/40 uppercase mb-8">
          Live Preview
        </h2>
        <div className="w-full max-w-[480px] transform transition-transform duration-300 hover:scale-[1.02]">
          <CardPreview data={form} preview />
        </div>
        <p className="mt-8 text-xs text-muted text-center max-w-xs leading-relaxed">
          Your card will be generated in 1080x1080 format. Click the card to zoom and preview details.
        </p>
      </div>
    </main>
  );
}