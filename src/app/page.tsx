"use client";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[max(4rem,env(safe-area-inset-top))] sm:pb-[max(4rem,env(safe-area-inset-bottom))]">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center gap-6 min-[480px]:gap-8 w-full max-w-[1100px] text-center">
        {/* Hero Section */}
        <div className="flex flex-col gap-4 min-[480px]:gap-6 animate-slide-up delay-100 w-full min-w-0">
          <h1
            className="text-[2.125rem] min-[400px]:text-4xl sm:text-5xl md:text-6xl lg:text-[4.75rem] xl:text-[5.75rem] font-black tracking-[-0.04em] text-heading leading-[0.95] text-balance max-w-[1000px] mx-auto px-1"
            style={{ fontWeight: 900, WebkitTextStroke: "0.2px currentColor", textShadow: "0 0 0.2px currentColor" }}
          >
            Plan less <span className="bg-gradient-to-r from-[#23468C] via-[#3b82f6] to-[#79D980] bg-clip-text text-transparent py-2">Linq faster</span>
          </h1>
          <p className="text-base min-[400px]:text-lg sm:text-xl text-heading/75 leading-[1.6] max-w-[980px] mx-auto text-balance font-normal px-1">
            Create your event, share a single registration link, and let attendees
            generate their own beautiful, downloadable conference cards.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mt-2 sm:mt-4 animate-slide-up delay-200 px-1">
          <Button href="/login" variant="blue" size="lg" className="w-full sm:w-auto min-h-12 px-5 text-[19.5px] justify-center">
            Get started
          </Button>
          <Button href="/login" variant="secondary" size="lg" className="w-full sm:w-auto min-h-12 glass-panel border-white/40 hover:bg-white/40 px-5 text-[19.5px] justify-center">
            Log in
          </Button>
        </div>

        {/* Branding Footer */}
        <div className="mt-8 animate-slide-up delay-300">
          <span className="text-[17px] font-normal tracking-[0.01em] text-heading/65 leading-[1.25]">
            Powered by AVTIVE
          </span>
        </div>
      </div>
    </main>
  );
}
