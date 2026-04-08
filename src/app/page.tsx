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
            For Event Organizers
          </span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col gap-4 animate-slide-up delay-100">
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-heading leading-[1.1] text-balance">
            Run events. Share a link. <span className="bg-gradient-to-r from-heading to-primary bg-clip-text text-transparent drop-shadow-sm">Done.</span>
          </h1>
          <p className="text-base sm:text-[17px] text-heading/70 leading-relaxed max-w-[440px] mx-auto text-balance font-medium">
            Create your event, share a single registration link, and let attendees
            generate their own beautiful, downloadable conference cards.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-6 animate-slide-up delay-200">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button variant="blue" size="lg" className="w-full sm:min-w-[180px] whitespace-nowrap">
              Get started
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
          <span className="text-[12px] font-bold tracking-[0.25em] text-heading/60 uppercase">
            Powered by AVTIVE
          </span>
        </div>
      </div>
    </main>
  );
}
