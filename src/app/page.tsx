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
        <div className="animate-slide-up inline-flex items-center gap-2 px-3.5 py-1.5 glass-panel rounded-full transition-transform hover:scale-105">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(121,217,128,0.8)]" />
          <span className="text-[11px] font-bold text-heading/80 tracking-[0.05em] uppercase">
            Confirmed Attendee
          </span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col gap-4 animate-slide-up delay-100">
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-heading leading-[1.1] text-balance">
            Your Smart <span className="bg-gradient-to-r from-heading to-primary bg-clip-text text-transparent drop-shadow-sm">Networking</span> Card
          </h1>
          <p className="text-base sm:text-[17px] text-heading/70 leading-relaxed max-w-[440px] mx-auto text-balance font-medium">
            Register once. Fill in your details. Download a breathtaking attendee card
            ready to share with the world.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-6 animate-slide-up delay-200">
          <Link href="/cards/new" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:min-w-[220px] whitespace-nowrap shadow-[0_4px_24px_-6px_rgba(121,217,128,0.6)]">
              Create your card
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:min-w-[140px] whitespace-nowrap glass-panel border-white/40 hover:bg-white/40">
              Log in
            </Button>
          </Link>
        </div>

        {/* Branding Footer */}
        <div className="mt-14 animate-slide-up delay-300">
          <span className="text-[12px] font-bold tracking-[0.25em] text-heading/30 uppercase">
            Powered by AVTIVE
          </span>
        </div>
      </div>
    </main>
  );
}