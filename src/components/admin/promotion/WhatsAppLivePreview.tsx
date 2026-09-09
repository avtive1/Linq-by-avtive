"use client";

import { CheckCheck } from "lucide-react";
import { PromotionTheme } from "./types";

interface WhatsAppLivePreviewProps {
  message: string;
  imageUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  theme?: PromotionTheme;
}

export function WhatsAppLivePreview({
  message,
  imageUrl,
  attachmentUrl,
  attachmentName,
  theme = "default",
}: WhatsAppLivePreviewProps) {
  const displayMessage = (message || "Type your message here...").replace(
    /\{\{name\}\}/gi,
    "Alex",
  );

  const themeStyles = {
    default: {
      header: "bg-[#075e54] text-white",
      avatar: "bg-emerald-700",
      canvas: "bg-[#efeae2]",
      bubble: "bg-[#d9fdd3] text-slate-800",
      time: "text-slate-500",
      check: "text-[#53bdeb]",
      attachmentBox: "bg-emerald-50 border-emerald-200/60 text-emerald-800",
      inputBtn: "bg-[#00a884]",
    },
    minimal: {
      header: "bg-[#18181b] text-white",
      avatar: "bg-zinc-700",
      canvas: "bg-[#f4f4f5]",
      bubble: "bg-white border border-zinc-200 text-zinc-900",
      time: "text-zinc-400",
      check: "text-zinc-700",
      attachmentBox: "bg-zinc-100 border-zinc-200 text-zinc-800",
      inputBtn: "bg-black",
    },
    dark: {
      header: "bg-[#111b21] text-white border-b border-white/10",
      avatar: "bg-slate-700",
      canvas: "bg-[#0b141a]",
      bubble: "bg-[#005c4b] text-[#e9edef]",
      time: "text-[#8696a0]",
      check: "text-[#53bdeb]",
      attachmentBox: "bg-[#025144] border-white/10 text-white",
      inputBtn: "bg-[#00a884]",
    },
    professional: {
      header: "bg-[#134e4a] text-white",
      avatar: "bg-teal-800",
      canvas: "bg-[#f0fdfa]",
      bubble: "bg-[#ccfbf1] text-teal-950",
      time: "text-teal-700",
      check: "text-[#0d9488]",
      attachmentBox: "bg-teal-100 border-teal-300 text-teal-900",
      inputBtn: "bg-[#0d9488]",
    },
    event: {
      header: "bg-[#c2410c] text-white",
      avatar: "bg-orange-800",
      canvas: "bg-[#fff7ed]",
      bubble: "bg-[#ffedd5] text-amber-950",
      time: "text-orange-700",
      check: "text-[#ea580c]",
      attachmentBox: "bg-orange-100 border-orange-300 text-orange-900",
      inputBtn: "bg-[#ea580c]",
    },
  };

  const t = themeStyles[theme] || themeStyles.default;

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Phone Mock Frame */}
      <div className="w-full max-w-[380px] border border-border/80 rounded-2xl shadow-sm overflow-hidden text-left">
        {/* WhatsApp Top App Bar */}
        <div className={`px-3.5 py-3 flex items-center justify-between transition-colors ${t.header}`}>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${t.avatar}`}
            >
              A
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">Alex Rivera</p>
              <p className="text-[10px] opacity-80 leading-tight">
                online · {theme}
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp Chat Canvas */}
        <div
          className={`p-4 min-h-[300px] flex flex-col justify-end gap-2 transition-colors ${t.canvas}`}
        >
          {/* Outgoing Message Bubble */}
          <div className="flex items-end justify-end">
            <div
              className={`max-w-[88%] rounded-lg rounded-tr-xs p-2.5 shadow-xs text-xs leading-relaxed flex flex-col gap-1.5 ${t.bubble}`}
            >
              {/* Optional Image */}
              {imageUrl ? (
                <div className="w-full h-32 rounded-md overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Attached media"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}

              {/* Text Message */}
              <div className="whitespace-pre-wrap">{displayMessage}</div>

              {/* Attachment link/name indicator if present */}
              {(attachmentUrl || attachmentName) ? (
                <div
                  className={`border rounded px-2 py-1 text-[10px] truncate ${t.attachmentBox}`}
                >
                  📎 {attachmentName || attachmentUrl}
                </div>
              ) : null}

              {/* Time & Read Receipts */}
              <div
                className={`flex items-center justify-end gap-1 text-[9px] self-end mt-0.5 ${t.time}`}
              >
                <span>12:30 PM</span>
                <CheckCheck size={12} className={t.check} />
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Message Input Bar */}
        <div className="px-3 py-2 bg-[#f0f2f5] border-t border-border/30 flex items-center justify-between text-xs text-slate-400">
          <span>Type a message</span>
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${t.inputBtn}`}
          >
            ➤
          </span>
        </div>
      </div>
    </div>
  );
}
