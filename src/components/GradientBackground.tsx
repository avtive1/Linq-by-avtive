"use client";

export default function GradientBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-white">
      {/* Soft blue glow in top-left */}
      <div 
        className="absolute -left-[10%] -top-[10%] w-[70%] h-[70%] rounded-full opacity-50 blur-[100px]"
        style={{
          background: "radial-gradient(circle at center, #D1E1FF 0%, transparent 70%)"
        }}
      />
      {/* Soft blue glow in bottom-right */}
      <div 
        className="absolute -right-[10%] -bottom-[10%] w-[60%] h-[60%] rounded-full opacity-30 blur-[100px]"
        style={{
          background: "radial-gradient(circle at center, #EBF5FF 0%, transparent 70%)"
        }}
      />
      {/* Subtle center grain/texture (optional but premium) */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />
    </div>
  );
}