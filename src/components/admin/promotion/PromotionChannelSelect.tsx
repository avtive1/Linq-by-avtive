"use client";

import { useState } from "react";
import { Mail, MessageSquare, ArrowRight, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button as ShadButton } from "@/components/ui/button";
import { PromotionChannel } from "./types";
import { TemplateList } from "./TemplateList";
import { TeamAccessDialog } from "./TeamAccessDialog";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || "w-5 h-5"}
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25a1.62 1.62 0 0 0-1.62 1.62c0 .9.72 1.63 1.62 1.63s1.63-.73 1.63-1.63c0-.9-.73-1.62-1.63-1.62Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || "w-5 h-5"}
      aria-hidden="true"
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.12 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.29-.25-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.25-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43s-.55-1.33-.76-1.82c-.2-.48-.41-.42-.56-.43h-.48Z" />
    </svg>
  );
}

export function PromotionChannelSelect() {
  const [activeChannel, setActiveChannel] = useState<PromotionChannel | null>(null);
  const [isTeamAccessOpen, setIsTeamAccessOpen] = useState(false);

  if (activeChannel) {
    return (
      <TemplateList
        channel={activeChannel}
        onBack={() => setActiveChannel(null)}
      />
    );
  }

  const channels = [
    {
      id: "newsletter" as const,
      title: "Newsletter",
      description: "Email attendees",
      icon: Mail,
      iconColor: "text-indigo-600 bg-indigo-50",
    },
    {
      id: "linkedin" as const,
      title: "LinkedIn",
      description: "Message attendees",
      icon: LinkedInIcon,
      iconColor: "text-[#0a66c2] bg-blue-50",
    },
    {
      id: "whatsapp" as const,
      title: "WhatsApp",
      description: "Message attendees",
      icon: WhatsAppIcon,
      iconColor: "text-[#25D366] bg-emerald-50",
    },
  ];

  return (
    <div className="w-full flex flex-col gap-6 text-left animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-heading">Promotion</h2>
          <p className="text-xs text-muted">Choose a channel</p>
        </div>

        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => setIsTeamAccessOpen(true)}
          className="text-xs h-8 gap-1.5 self-start sm:self-auto border-border/60 text-heading"
        >
          <Shield size={13} className="text-muted" />
          Team Access
        </ShadButton>
      </div>

      {/* 3 Simple Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <Card
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className="group flex flex-col justify-between p-6 bg-white border border-border/60 rounded-xl hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all duration-200"
            >
              <div className="flex flex-col gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel.iconColor} group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-heading leading-tight">
                    {channel.title}
                  </h3>
                  <p className="text-xs text-muted mt-1">{channel.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-border/30 mt-4">
                <span className="text-xs font-semibold text-primary">Open channel</span>
                <ArrowRight
                  size={15}
                  className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Team Access Popup */}
      <TeamAccessDialog open={isTeamAccessOpen} onOpenChange={setIsTeamAccessOpen} />
    </div>
  );
}
