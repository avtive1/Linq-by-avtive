"use client";
import Image from "next/image";
import Link from "next/link";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full flex flex-col items-stretch overflow-x-hidden overflow-y-auto bg-surface px-[max(0.75rem,env(safe-area-inset-left))] py-[max(1.75rem,env(safe-area-inset-top))] sm:px-[max(1.5rem,env(safe-area-inset-left))] sm:py-[max(2.5rem,env(safe-area-inset-top))]">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Sticky nav bar */}
        <header className="sticky top-0 z-20 mb-10 w-full max-w-5xl border-b border-border/80 bg-[rgba(250,250,252,0.85)]/95 backdrop-blur-xl rounded-b-xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <Image
              src="/linq-logo.png"
              alt="Linq"
              width={90}
              height={26}
              className="h-7 w-auto object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-[13px] text-text-muted">
            <Link href="/organization/register" className="font-medium text-primary hover:text-primary-strong transition-colors">
              Register Organization
            </Link>
            <Link href="/organization/status" className="hidden sm:inline-block hover:text-text-primary transition-colors">
              Check Status
            </Link>
            <Link href="/login" className="font-medium text-text-primary hover:text-royal-indigo transition-colors">
              Log in
            </Link>
          </div>
        </header>

        <section className="w-full max-w-4xl border-b border-border bg-surface/80 rounded-2xl px-5 sm:px-8 pt-12 pb-10 sm:pb-12 shadow-[0_12px_40px_rgba(26,23,77,0.08)] motion-token-enter">
          <div className="mx-auto flex max-w-[900px] flex-col gap-6 text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-lavender">
              Digital networking · Event cards · Organization Portals
            </p>
            <h1 className="text-[clamp(2.6rem,6vw,4.4rem)] font-light leading-[1.05] tracking-[-0.04em] text-graphite text-balance">
              Every connection{" "}
              <span className="not-italic text-royal-indigo">creates opportunity</span>
            </h1>
            <p className="max-w-[520px] text-[15px] leading-[1.65] text-text-muted">
              Linq turns event registration and organization onboarding into a single, elegant step. Share one link,
              let attendees generate beautiful, scannable cards, and manage every organization seamlessly.
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              href="/login"
              variant="primary"
              size="lg"
              className="w-full sm:w-auto justify-center rounded-full px-6"
            >
              Get started
            </Button>
            <Button
              href="/organization/register"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto justify-center rounded-full border-border/80 bg-canvas hover:bg-surface"
            >
              Register Organization
            </Button>
            <Button
              href="/login"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto justify-center rounded-full border-border/80 bg-canvas hover:bg-surface"
            >
              Log in
            </Button>
          </div>
        </section>

        {/* Branding footer */}
        <div className="mt-8 text-center text-[12px] text-text-xmuted">
          Powered by <span className="font-medium text-text-muted">Linq</span>
        </div>
      </div>
    </main>
  );
}
