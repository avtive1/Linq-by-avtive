"use client";

import { CheckCheck } from "lucide-react";

interface WhatsAppLivePreviewProps {
  message: string;
  imageUrl?: string;
  attachmentUrl?: string;
}

export function WhatsAppLivePreview({
  message,
  imageUrl,
  attachmentUrl,
}: WhatsAppLivePreviewProps) {
  const displayMessage = (message || "Type your message here...").replace(
    /\{\{name\}\}/gi,
    "Alex",
  );

  return (
    <div className="w-full flex flex-col items-center">
      {/* Phone Mock Frame */}
      <div className="w-full max-w-[380px] bg-[#efeae2] border border-border/80 rounded-2xl shadow-sm overflow-hidden text-left">
        {/* WhatsApp Top App Bar */}
        <div className="bg-[#075e54] text-white px-3.5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white">
              A
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">Alex Rivera</p>
              <p className="text-[10px] text-white/80 leading-tight">online</p>
            </div>
          </div>
        </div>

        {/* WhatsApp Chat Canvas */}
        <div className="p-4 min-h-[300px] flex flex-col justify-end gap-2 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
          {/* Outgoing Message Bubble */}
          <div className="flex items-end justify-end">
            <div className="max-w-[88%] bg-[#d9fdd3] text-slate-800 rounded-lg rounded-tr-xs p-2.5 shadow-xs text-xs leading-relaxed flex flex-col gap-1.5">
              {/* Optional Image */}
              {imageUrl ? (
                <div className="w-full h-32 rounded-md overflow-hidden bg-emerald-100/50">
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

              {/* Attachment link indicator if present */}
              {attachmentUrl ? (
                <div className="bg-emerald-50 border border-emerald-200/60 rounded px-2 py-1 text-[10px] text-emerald-800 truncate">
                  📎 {attachmentUrl}
                </div>
              ) : null}

              {/* Time & Read Receipts */}
              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 self-end mt-0.5">
                <span>12:30 PM</span>
                <CheckCheck size={12} className="text-[#53bdeb]" />
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Message Input Bar */}
        <div className="px-3 py-2 bg-[#f0f2f5] border-t border-border/30 flex items-center justify-between text-xs text-slate-400">
          <span>Type a message</span>
          <span className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs">
            ➤
          </span>
        </div>
      </div>
    </div>
  );
}
