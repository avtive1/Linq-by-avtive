"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GradientBackground from "@/components/GradientBackground";
import { TextInput, Button, FilePicker, Skeleton } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { CardPreview } from "@/components/CardPreview";
import { supabase, getFileUrl as getSupabaseFileUrl } from "@/lib/supabase";
import { toast } from "sonner";

type FormState = {
  name: string;
  role: string;
  company: string;
  email: string;
  eventName: string;
  sessionDate: string;
  location: string;
  track: string;
  photo: string;
  year: string;
  linkedin: string;
};

export default function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [form, setForm] = useState<FormState>({
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
  const [originalPhotoPath, setOriginalPhotoPath] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
        setForm({
          name: record.name || "",
          role: record.role || "",
          company: record.company || "",
          email: record.card_email || "",
          eventName: record.event_name || "",
          sessionDate: record.session_date || "",
          location: record.location || "",
          track: record.track || "",
          photo: record.photo_url ? getSupabaseFileUrl("attendee_photos", record.photo_url) : "",
          year: record.year || new Date().getFullYear().toString(),
          linkedin: record.linkedin || "",
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
    const required: Array<[keyof FormState, string]> = [
      ["name", "Full Name"],
      ["role", "Role/Title"],
      ["company", "Organization"],
      ["email", "Email"],
    ];
    required.forEach(([key, label]) => {
      if (!form[key]) newErrors[key] = `${label} is required`;
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
    setSaving(true);

    try {
      let photo_url = originalPhotoPath || "";

      // If the user picked a new photo, the form.photo will be a fresh data: URL.
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

        // Remove the old photo, if any, after a successful upload.
        if (originalPhotoPath) {
          await supabase.storage.from("attendee_photos").remove([originalPhotoPath]);
        }
        photo_url = uploadData.path;
      }

      const { error: updateError } = await supabase
        .from("attendees")
        .update({
          name: form.name,
          role: form.role,
          company: form.company,
          card_email: form.email,
          track: form.track || "",
          linkedin: extractLinkedInHandle(form.linkedin),
          photo_url,
        })
        .eq("id", id);

      if (updateError) {
        toast.error("Failed to save changes.");
        throw updateError;
      }

      toast.success("Card updated.");
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
          </div>
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

      {/* Sidebar */}
      <div className="relative z-10 w-full lg:w-[460px] glass-panel border-r-border/30 p-6 md:p-11 overflow-y-auto lg:h-screen animate-slide-up">
        <div className="flex items-center gap-3 mb-8 -ml-1 sm:-ml-2">
          <Link
            href={eventId ? `/dashboard/events/${eventId}` : "/dashboard"}
            className="inline-flex items-center gap-2 text-xs font-bold text-heading hover:text-primary-strong hover:underline underline-offset-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[4px] group"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Event
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-heading tracking-tight">Edit Card</h1>
            <p className="text-sm text-muted">Update the attendee details below.</p>
          </div>

          <div className="flex flex-col gap-5">
            <TextInput label="Full Name" required value={form.name} error={errors.name} onChange={update("name")} />
            <TextInput label="Role/Title" required value={form.role} error={errors.role} onChange={update("role")} />
            <TextInput label="Organization" required value={form.company} error={errors.company} onChange={update("company")} />
            <TextInput label="Email" required icon="email" value={form.email} error={errors.email} onChange={update("email")} />
            <TextInput label="Track (Optional)" value={form.track} onChange={update("track")} />
            <TextInput label="LinkedIn (Optional)" value={form.linkedin} onChange={update("linkedin")} />
            <FilePicker
              label="Replace Photo (Optional)"
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
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col items-center py-8 px-4 sm:px-6 lg:h-screen min-h-[500px] lg:min-h-0 overflow-y-auto animate-slide-up delay-100">
        <h2 className="text-sm font-semibold tracking-[0.04em] text-muted/60 mb-6">Live preview</h2>
        <div className="preview-scale-wrapper w-full">
          <div className="preview-card-capture" style={{ width: "800px", aspectRatio: "800/420" }}>
            <CardPreview data={form} preview />
          </div>
        </div>
      </div>

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
          .preview-scale-wrapper { overflow: hidden; }
          .preview-card-capture {
            transform: scale(calc((100vw - 48px) / 800));
            margin-bottom: calc((420px * ((100vw - 48px) / 800)) - 420px);
          }
        }
        @media (min-width: 1025px) {
          .preview-scale-wrapper { overflow: hidden; }
          .preview-card-capture {
            transform: scale(calc((100vw - 480px - 48px) / 800));
            margin-bottom: calc((420px * ((100vw - 480px - 48px) / 800)) - 420px);
          }
        }
        @media (min-width: 1600px) {
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
