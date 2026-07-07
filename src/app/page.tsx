"use client";
import GradientBackground from "@/components/GradientBackground";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full flex flex-col items-stretch overflow-x-hidden overflow-y-auto bg-surface px-[max(0.75rem,env(safe-area-inset-left))] py-[max(1.75rem,env(safe-area-inset-top))] sm:px-[max(1.5rem,env(safe-area-inset-left))] sm:py-[max(2.5rem,env(safe-area-inset-top))]">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Sticky nav bar */}
        <header className="sticky top-0 z-20 mb-10 w-full max-w-5xl border-b border-border/80 bg-[rgba(250,250,252,0.85)]/95 backdrop-blur-xl rounded-b-xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-royal-indigo/90">
              <span className="absolute inset-0 rounded-full bg-royal-indigo/40 animate-ping" />
            </span>
            <span className="text-[11px] font-mono tracking-[0.12em] uppercase text-text-xmuted">
              AVTIVE LINQ
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-[13px] text-text-muted">
            <span>Product</span>
            <span>How it works</span>
            <span>Pricing</span>
          </div>
        </header>

        <section className="w-full max-w-4xl border-b border-border bg-surface/80 rounded-2xl px-5 sm:px-8 pt-12 pb-10 sm:pb-12 shadow-[0_12px_40px_rgba(26,23,77,0.08)] motion-token-enter">
          <div className="mx-auto flex max-w-[900px] flex-col gap-6 text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-lavender">
              Digital networking · Event cards
            </p>
            <h1 className="text-[clamp(2.6rem,6vw,4.4rem)] font-light leading-[1.05] tracking-[-0.04em] text-graphite text-balance">
              Every connection{" "}
              <span className="italic text-royal-indigo">creates opportunity</span>
            </h1>
            <p className="max-w-[520px] text-[15px] leading-[1.65] text-text-muted">
              Linq turns event registration into a single, elegant step. Share one link,
              let attendees generate beautiful, scannable cards, and keep every
              introduction in one place.
            </p>

            {/* Hero metadata row */}
            <dl className="mt-4 grid gap-4 text-[12px] text-text-xmuted sm:grid-cols-4">
              <div className="space-y-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-xmuted">
                  Category
                </dt>
                <dd className="text-text-muted">Digital networking</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-xmuted">
                  Aesthetic
                </dt>
                <dd className="text-text-muted">Refined indigo</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-xmuted">
                  Brand tone
                </dt>
                <dd className="text-text-muted">Confident, human, warm</dd>
              </div>
              <div className="space-y-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-xmuted">
                  Last updated
                </dt>
                <dd className="text-text-muted">2026</dd>
              </div>
            </dl>
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
          Powered by <span className="font-medium text-text-muted">AVTIVE</span>
        </div>
      </div>
    </main>
  );
}
