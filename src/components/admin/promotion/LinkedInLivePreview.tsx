"use client";

interface LinkedInLivePreviewProps {
  message: string;
  caption?: string;
}

export function LinkedInLivePreview({ message, caption }: LinkedInLivePreviewProps) {
  const displayMessage = (message || "Type your message here...").replace(
    /\{\{name\}\}/gi,
    "Alex",
  );

  return (
    <div className="w-full flex flex-col items-center">
      {/* LinkedIn Window Frame */}
      <div className="w-full max-w-[420px] bg-white border border-border/70 rounded-xl shadow-xs overflow-hidden text-left">
        {/* Top LinkedIn Chat Header */}
        <div className="bg-[#0a66c2] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
              in
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">Alex Rivera</p>
              <p className="text-[10px] text-white/80 leading-tight">Attendee · Linq Event</p>
            </div>
          </div>
          {caption && (
            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded text-white/90">
              {caption}
            </span>
          )}
        </div>

        {/* Chat Canvas */}
        <div className="p-4 bg-[#f3f2f0] min-h-[260px] flex flex-col justify-end gap-3">
          {/* Sender Bubble */}
          <div className="flex items-end justify-end gap-2">
            <div className="max-w-[85%] bg-white border border-border/50 rounded-2xl rounded-br-xs p-3.5 shadow-xs text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {displayMessage}
              <div className="mt-1 text-[9px] text-muted text-right">Just now</div>
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
