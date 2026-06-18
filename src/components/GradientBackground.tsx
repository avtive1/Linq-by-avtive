"use client";

export default function GradientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-light-2">
      <div
        className="absolute -top-[20%] -left-[20%] h-[80%] w-[80%] animate-pulse rounded-full opacity-60 mix-blend-multiply blur-[120px] filter"
        style={{
          background: "radial-gradient(circle at center, var(--color-light-3) 0%, transparent 70%)",
          animationDuration: "8s",
        }}
      />
      <div
        className="absolute -right-[20%] -bottom-[20%] h-[80%] w-[80%] animate-pulse rounded-full opacity-50 mix-blend-multiply blur-[120px] filter"
        style={{
          background: "radial-gradient(circle at center, var(--color-light-1) 0%, transparent 70%)",
          animationDuration: "12s",
          animationDelay: "2s",
        }}
      />
      <div
        className="absolute top-[40%] left-[10%] h-[60%] w-[60%] animate-pulse rounded-full opacity-40 mix-blend-multiply blur-[100px] filter"
        style={{
          background: "radial-gradient(circle at center, var(--color-surface) 0%, transparent 60%)",
          animationDuration: "10s",
          animationDelay: "1s",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02]" />
    </div>
  );
}
