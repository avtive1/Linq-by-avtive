import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";
import { Info } from "lucide-react";
import { pb, getFileUrl } from "@/lib/pocketbase";
import CardView from "./CardView";
import { CardData } from "@/types/card";

// This makes the page a Server Component
export default async function CardViewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;
  let card: CardData | null = null;

  try {
    // Fetch directly from PocketBase on the server (no CORS issues!)
    const record = await pb.collection("attendees").getOne(id, {
        $autoCancel: false,
    });
    
    card = {
        id: record.id,
        name: record.name,
        role: record.role,
        company: record.company,
        email: record.cardEmail,
        eventName: record.eventName,
        sessionDate: record.sessionDate,
        location: record.location,
        track: record.track,
        year: record.year,
        linkedin: record.linkedin,
        photo: record.photo ? getFileUrl("attendees", record.id, record.photo) : undefined,
    };
  } catch (err) {
    console.error("Server-side fetch error:", err);
    card = null;
  }

  if (!card) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-center">
        <GradientBackground />
        <div className="relative z-10 flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border border-border shadow-xl">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-muted">
            <Info size={24} />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-heading font-semibold">Card not found</p>
            <p className="text-sm text-muted">
                The card you&apos;re looking for doesn&apos;t exist or my connection to the database is sleeping.
            </p>
          </div>
          <Link href="/dashboard" className="mt-2">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return <CardView card={card} />;
}