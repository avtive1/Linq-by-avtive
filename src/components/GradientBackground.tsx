"use client";

export default function GradientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-light-2">
      {/* Glow 1 - Light Blue/Grey */}
      <div 
        className="absolute -left-[20%] -top-[20%] w-[80%] h-[80%] rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse"
        style={{
          background: "radial-gradient(circle at center, var(--color-light-3) 0%, transparent 70%)",
          animationDuration: "8s"
        }}
      />
      {/* Glow 2 - Light Green/Grey */}
      <div 
        className="absolute -right-[20%] -bottom-[20%] w-[80%] h-[80%] rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-pulse"
        style={{
          background: "radial-gradient(circle at center, var(--color-light-1) 0%, transparent 70%)",
          animationDuration: "12s",
          animationDelay: "2s"
        }}
      />
      {/* Glow 3 - Central soft highlight */}
      <div 
        className="absolute left-[10%] top-[40%] w-[60%] h-[60%] rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-pulse"
        style={{
          background: "radial-gradient(circle at center, var(--color-light-3) 0%, transparent 60%)",
          animationDuration: "10s",
          animationDelay: "1s"
        }}
      />
      {/* Subtle grain/texture */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
    </div>
  );
}
