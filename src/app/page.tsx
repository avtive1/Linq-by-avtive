"use client";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-[480px] text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/50 border border-border/40 rounded-full backdrop-blur-sm shadow-sm transition-all hover:bg-white/80">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-semibold text-primary tracking-tight uppercase">
            Confirmed Attendee
          </span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading leading-[1.15]">
            Your Smart <span className="text-primary">Networking</span> Card
          </h1>
          <p className="text-base sm:text-lg text-muted leading-relaxed max-w-[420px] mx-auto">
            Register once. Fill in your details. Download a stunning attendee card
            ready to share with the world.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-4">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:min-w-[200px] whitespace-nowrap">
              Create your card
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:min-w-[120px] whitespace-nowrap">
              Log in
            </Button>
          </Link>
        </div>

        {/* Branding Footer */}
        <div className="mt-12">
          <span className="text-[12px] font-medium tracking-[0.2em] text-muted/40 uppercase">
            Powered by AVTIVE
          </span>
        </div>
      </div>
    </main>
  );
}