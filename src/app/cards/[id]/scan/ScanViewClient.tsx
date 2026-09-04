"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  ExternalLink, 
  IdCard, 
  Calendar, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  Pause,
  Play,
  ArrowRight
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AttendeeAttendanceCheckinResult } from "@/lib/services/attendance.service";

function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

interface ScanViewClientProps {
  cardId: string;
  result: AttendeeAttendanceCheckinResult;
}

export function ScanViewClient({ cardId, result }: ScanViewClientProps) {
  const { success, alreadyAttended, message, attendee, event, attendedAt } = result;

  const [countdown, setCountdown] = useState<number | null>(attendee?.linkedinUrl ? 3 : null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!attendee?.linkedinUrl || isPaused || countdown === null) return;

    if (countdown <= 0) {
      window.location.href = attendee.linkedinUrl;
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isPaused, attendee?.linkedinUrl]);

  const handlePauseToggle = () => {
    setIsPaused((prev) => !prev);
  };

  const formattedTimestamp = attendedAt
    ? new Date(attendedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const formattedDate = attendedAt
    ? new Date(attendedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : null;

  if (!success || !attendee) {
    return (
      <Card className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">QR Scan Failed</h1>
          <p className="text-sm text-neutral-400">{message || "Unrecognized or invalid attendee badge."}</p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/"
            className={buttonVariants({
              variant: "secondary",
              className: "w-full py-3 rounded-xl font-medium bg-neutral-800 hover:bg-neutral-700 text-white",
            })}
          >
            Return to Homepage
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-4 sm:space-y-6">
      {/* Attendance Status Banner Card */}
      <Card className="overflow-hidden rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl">
        <div className="p-6 sm:p-8 text-center space-y-6">
          {/* Status Icon */}
          <div className="mx-auto flex flex-col items-center">
            {alreadyAttended ? (
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 animate-in fade-in zoom-in duration-300">
                <ShieldCheck className="h-8 w-8" />
              </div>
            ) : (
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-8 w-8" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              </div>
            )}

            <div className="mt-4 space-y-1">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  alreadyAttended
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {alreadyAttended ? "Already Checked In" : "Attendance Confirmed"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight pt-1">
                {alreadyAttended ? "Welcome Back!" : "You're Checked In!"}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                {alreadyAttended
                  ? `Attendance was previously recorded on ${formattedDate} at ${formattedTimestamp}.`
                  : `Attendance marked at ${formattedTimestamp} on ${formattedDate}.`}
              </p>
            </div>
          </div>

          {/* Attendee & Event Info Box */}
          <div className="rounded-xl bg-neutral-950/60 border border-neutral-800/80 p-4 sm:p-5 text-left space-y-4">
            <div className="flex items-center gap-3.5">
              {attendee.photoUrl && attendee.photoUrl !== "/default-avatar-placeholder.svg" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attendee.photoUrl}
                  alt={attendee.name}
                  className="h-14 w-14 rounded-full object-cover border border-white/20 shadow-md shrink-0"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-linear-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-white font-bold text-xl border border-neutral-700 shadow-md shrink-0">
                  {attendee.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-white truncate">{attendee.name}</h2>
                <p className="text-xs sm:text-sm text-neutral-300 truncate">
                  {[attendee.role, attendee.company].filter(Boolean).join(" • ") || "Event Attendee"}
                </p>
                {attendee.track && (
                  <span className="inline-block mt-1 text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    {attendee.track}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-800/80 pt-3.5 space-y-2 text-xs text-neutral-300">
              {event?.name && (
                <div className="flex items-center gap-2 font-medium text-white/90">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{event.name}</span>
                </div>
              )}
              {event?.location && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              {event?.time && (
                <div className="flex items-center gap-2 text-neutral-400">
                  <Clock className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  <span>{event.time}</span>
                </div>
              )}
            </div>
          </div>

          {/* LinkedIn Flow Continuity */}
          {attendee.linkedinUrl ? (
            <div className="rounded-xl bg-blue-950/30 border border-blue-800/40 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <LinkedInIcon className="h-4 w-4 fill-current" />
                  <span>LinkedIn Profile</span>
                </div>

                {countdown !== null && (
                  <button
                    type="button"
                    onClick={handlePauseToggle}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-3 w-3 text-emerald-400" />
                        <span>Resume redirect</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3 w-3 text-amber-400" />
                        <span>Redirecting in {countdown}s (pause)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-xs text-neutral-300 text-left">
                Connect with <span className="font-semibold text-white">{attendee.name}</span> on LinkedIn for networking and event follow-up.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={attendee.linkedinUrl}
                  className={buttonVariants({
                    variant: "default",
                    className:
                      "w-full sm:flex-1 py-2.5 rounded-xl font-medium bg-[#0A66C2] hover:bg-[#004182] text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50",
                  })}
                >
                  <span>Open LinkedIn</span>
                  <ExternalLink className="h-4 w-4" />
                </a>

                {countdown !== null && !isPaused && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCountdown(null)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300"
                  >
                    Stay on Page
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {/* Action Links */}
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href={`/cards/${encodeURIComponent(cardId)}?share=true`}
              className={buttonVariants({
                variant: "secondary",
                className:
                  "w-full py-2.5 rounded-xl font-medium bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center gap-2",
              })}
            >
              <IdCard className="h-4 w-4 text-neutral-400" />
              <span>View Attendee Badge</span>
              <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
