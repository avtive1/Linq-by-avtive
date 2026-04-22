"use client";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center px-2 sm:px-4 lg:px-6 py-12 sm:py-16 overflow-hidden">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-[1100px] text-center">
        {/* Hero Section */}
        <div className="flex flex-col gap-6 animate-slide-up delay-100">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-[-0.03em] text-heading leading-[1.05] text-balance max-w-[760px] mx-auto">
            Run events. Share a link.
            <br />
            <span className="bg-gradient-to-r from-heading to-primary bg-clip-text text-transparent drop-shadow-sm">Done.</span>
          </h1>
          <p className="text-base sm:text-lg text-heading/75 leading-[1.6] max-w-[980px] mx-auto text-balance font-normal">
            Create your event, share a single registration link, and let attendees
            generate their own beautiful, downloadable conference cards.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-4 animate-slide-up delay-200">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button variant="blue" size="lg" className="w-full whitespace-nowrap h-12 px-5 text-[19.5px]">
              Get started
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full whitespace-nowrap glass-panel border-white/40 hover:bg-white/40 h-12 px-5 text-[19.5px]">
              Log in
            </Button>
          </Link>
        </div>

        {/* Branding Footer */}
        <div className="mt-8 animate-slide-up delay-300">
          <span className="text-[18px] font-normal tracking-[0.01em] text-heading/65 leading-[1.25]">
            Powered by AVTIVE
          </span>
        </div>
      </div>
    </main>
  );
}
