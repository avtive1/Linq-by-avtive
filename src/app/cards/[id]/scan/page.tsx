import type { Metadata } from "next";
import GradientBackground from "@/components/GradientBackground";
import { markAttendeeAttendanceById } from "@/lib/services/attendance.service";
import { ScanViewClient } from "./ScanViewClient";
import { isValidUuid } from "@/lib/validation/uuid";
import { queryNeonOne } from "@/lib/neon-db";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const defaultTitle = "Attendee Check-in | AVTIVE";
  const defaultDesc = "Attendee badge attendance verification and professional networking.";

  if (!isValidUuid(id)) {
    return { title: defaultTitle, description: defaultDesc };
  }

  try {
    const attendee = await queryNeonOne<{ name: string | null; event_name: string | null }>(
      `SELECT name, event_name FROM public.attendees WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (attendee?.name) {
      const name = String(attendee.name).trim();
      const eventName = attendee.event_name ? String(attendee.event_name).trim() : "Event";
      return {
        title: `${name} · ${eventName} Check-in | AVTIVE`,
        description: `Verified attendance and professional profile for ${name} at ${eventName}.`,
      };
    }
  } catch {
    // fallback to default
  }

  return { title: defaultTitle, description: defaultDesc };
}

export default async function CardScanPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const result = await markAttendeeAttendanceById(id);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-black text-white selection:bg-purple-500 selection:text-white">
      <GradientBackground />
      <div className="relative z-10 w-full flex justify-center py-6 sm:py-10">
        <ScanViewClient cardId={id} result={result} />
      </div>
    </main>
  );
}
