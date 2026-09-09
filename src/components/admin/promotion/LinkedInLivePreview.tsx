"use client";

import { PromotionTheme } from "./types";

interface LinkedInLivePreviewProps {
  message: string;
  caption?: string;
  theme?: PromotionTheme;
}

export function LinkedInLivePreview({
  message,
  caption,
  theme = "default",
}: LinkedInLivePreviewProps) {
  const displayMessage = (message || "Type your message here...").replace(
    /\{\{name\}\}/gi,
    "Alex",
  );

  const themeStyles = {
    default: {
      header: "bg-[#0a66c2] text-white",
      canvas: "bg-[#f3f2f0]",
      bubble: "bg-white border-border/50 text-slate-800",
      avatarBg: "bg-white/20",
    },
    minimal: {
      header: "bg-[#18181b] text-white",
      canvas: "bg-[#f4f4f5]",
      bubble: "bg-white border-zinc-300 text-zinc-900 rounded-lg",
      avatarBg: "bg-zinc-800",
    },
    dark: {
      header: "bg-[#0f172a] text-white border-b border-slate-700",
      canvas: "bg-[#1e293b]",
      bubble: "bg-[#334155] border-slate-600 text-slate-100 shadow-md",
      avatarBg: "bg-slate-700",
    },
    professional: {
      header: "bg-[#172554] text-white",
      canvas: "bg-[#f1f5f9]",
      bubble: "bg-white border-slate-300 text-slate-900",
      avatarBg: "bg-[#1e3a8a]",
    },
    event: {
      header: "bg-gradient-to-r from-indigo-600 to-purple-600 text-white",
      canvas: "bg-[#faf5ff]",
      bubble: "bg-white border-purple-200 text-slate-900 shadow-xs",
      avatarBg: "bg-purple-700",
    },
  };

  const t = themeStyles[theme] || themeStyles.default;

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* LinkedIn Window Frame */}
      <div className="w-full max-w-[420px] bg-white border border-border/70 rounded-xl shadow-xs overflow-hidden text-left">
        {/* Top LinkedIn Chat Header */}
        <div className={`px-4 py-3 flex items-center justify-between transition-colors ${t.header}`}>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${t.avatarBg}`}
            >
              in
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">Alex Rivera</p>
              <p className="text-[10px] opacity-80 leading-tight">
                Attendee · Linq Event ({theme})
              </p>
            </div>
          </div>
          {caption && (
            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded text-white/90">
              {caption}
            </span>
          )}
        </div>

        {/* Chat Canvas */}
        <div className={`p-4 min-h-[260px] flex flex-col justify-end gap-3 transition-colors ${t.canvas}`}>
          {/* Sender Bubble */}
          <div className="flex items-end justify-end gap-2">
            <div
              className={`max-w-[85%] border rounded-2xl rounded-br-xs p-3.5 shadow-xs text-xs leading-relaxed whitespace-pre-wrap ${t.bubble}`}
            >
              {displayMessage}
              <div className="mt-1 text-[9px] opacity-60 text-right">Just now</div>
            </div>
          </div>
        </div>

        {/* Input Bar Hint */}
        <div className="px-4 py-2.5 bg-white border-t border-border/40 flex items-center justify-between text-xs text-muted">
          <span>Write a message...</span>
          <span className="text-[#0a66c2] font-semibold text-[11px]">Send</span>
        </div>
      </div>
    </div>
  );
}
