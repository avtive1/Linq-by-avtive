"use client";

interface NewsletterLivePreviewProps {
  heading: string;
  message: string;
  imageUrl?: string;
  subject?: string;
}

export function NewsletterLivePreview({
  heading,
  message,
  imageUrl,
  subject,
}: NewsletterLivePreviewProps) {
  return (
    <div className="w-full flex flex-col items-center">
      {/* Email Client Header Bar */}
      <div className="w-full max-w-[480px] bg-slate-100 border border-border/60 rounded-t-xl px-4 py-2.5 flex items-center gap-2 text-xs text-muted">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
        </div>
        <span className="truncate ml-2 font-medium text-slate-600">
          {subject || "Subject preview..."}
        </span>
      </div>

      {/* Email Body Canvas */}
      <div className="w-full max-w-[480px] bg-white border-x border-b border-border/60 rounded-b-xl shadow-xs p-6 flex flex-col gap-4 text-left">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-primary flex items-center justify-center text-white text-xs font-bold">
              L
            </span>
            <span className="text-sm font-semibold tracking-tight text-heading">Linq</span>
          </div>
          <span className="text-[11px] text-muted font-medium uppercase tracking-wider">
            Newsletter
          </span>
        </div>

        {/* Hero Image */}
        {imageUrl ? (
          <div className="w-full h-40 rounded-lg overflow-hidden bg-slate-100 border border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Newsletter banner"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Graceful fallback on broken image URL
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : null}

        {/* Heading */}
        <h3 className="text-lg font-bold text-heading leading-snug">
          {heading || "Your Heading Here"}
        </h3>

        {/* Body Paragraphs */}
        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap flex flex-col gap-2">
          {message || "Enter your newsletter message..."}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <span className="inline-block bg-primary text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs">
            Open Attendee Card
          </span>
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 pt-4 mt-2 text-[10px] text-muted text-center leading-relaxed">
          Sent by Linq Event Operations. You are receiving this because you registered for this event.
        </div>
      </div>
    </div>
  );
}
