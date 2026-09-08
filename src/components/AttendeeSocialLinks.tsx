"use client";

import React from "react";
import { AttendeeSocialLinks, SocialPlatform } from "@/types/card";
import { formatAttendeeLinkedInUrl } from "@/lib/validation/social-urls";
import { ExternalLink, Globe } from "lucide-react";

export function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

export function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function TwitterXIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function YouTubeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function getSocialPlatformIcon(platform: SocialPlatform, className = "h-4 w-4") {
  switch (platform) {
    case "linkedin":
      return <LinkedInIcon className={className} />;
    case "instagram":
      return <InstagramIcon className={className} />;
    case "twitter":
      return <TwitterXIcon className={className} />;
    case "facebook":
      return <FacebookIcon className={className} />;
    case "github":
      return <GitHubIcon className={className} />;
    case "tiktok":
      return <TikTokIcon className={className} />;
    case "youtube":
      return <YouTubeIcon className={className} />;
    case "website":
      return <Globe className={className} />;
  }
}

export const PLATFORM_COLOR_CLASSES: Record<SocialPlatform, { bg: string; text: string; hover: string; border: string }> = {
  linkedin: {
    bg: "bg-[#0A66C2]/15",
    text: "text-[#70B5F9]",
    hover: "hover:bg-[#0A66C2]/30 hover:border-[#0A66C2]/60",
    border: "border-[#0A66C2]/30",
  },
  instagram: {
    bg: "bg-pink-500/15",
    text: "text-pink-300",
    hover: "hover:bg-pink-500/30 hover:border-pink-500/60",
    border: "border-pink-500/30",
  },
  twitter: {
    bg: "bg-neutral-800/80",
    text: "text-neutral-200",
    hover: "hover:bg-neutral-700/80 hover:border-neutral-500/60",
    border: "border-neutral-700/50",
  },
  facebook: {
    bg: "bg-blue-600/15",
    text: "text-blue-300",
    hover: "hover:bg-blue-600/30 hover:border-blue-600/60",
    border: "border-blue-600/30",
  },
  github: {
    bg: "bg-neutral-800/80",
    text: "text-neutral-200",
    hover: "hover:bg-neutral-700/80 hover:border-neutral-500/60",
    border: "border-neutral-700/50",
  },
  tiktok: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-300",
    hover: "hover:bg-cyan-500/30 hover:border-cyan-500/60",
    border: "border-cyan-500/30",
  },
  youtube: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    hover: "hover:bg-red-500/30 hover:border-red-500/60",
    border: "border-red-500/30",
  },
  website: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    hover: "hover:bg-emerald-500/30 hover:border-emerald-500/60",
    border: "border-emerald-500/30",
  },
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  twitter: "X",
  facebook: "Facebook",
  github: "GitHub",
  tiktok: "TikTok",
  youtube: "YouTube",
  website: "Website",
};

interface AttendeeSocialLinksProps {
  linkedin?: string | null;
  socialLinks?: AttendeeSocialLinks | null;
  attendeeName?: string | null;
  className?: string;
  variant?: "pills" | "compact";
}

export function AttendeeSocialLinksBar({
  linkedin,
  socialLinks,
  className = "",
  variant = "pills",
}: AttendeeSocialLinksProps) {
  const normalizedLinkedin = linkedin ? formatAttendeeLinkedInUrl(linkedin) : "";

  // Compile list of available links
  const links: Array<{ platform: SocialPlatform; label: string; url: string }> = [];

  if (normalizedLinkedin) {
    links.push({
      platform: "linkedin",
      label: "LinkedIn",
      url: normalizedLinkedin,
    });
  }

  if (socialLinks) {
    const platforms: SocialPlatform[] = [
      "instagram",
      "twitter",
      "facebook",
      "github",
      "tiktok",
      "youtube",
      "website",
    ];

    for (const p of platforms) {
      const url = socialLinks[p];
      if (url && typeof url === "string" && url.trim()) {
        links.push({
          platform: p,
          label: PLATFORM_LABELS[p],
          url: url.trim(),
        });
      }
    }
  }

  if (links.length === 0) return null;

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        {links.map((link) => {
          const colors = PLATFORM_COLOR_CLASSES[link.platform];
          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${link.label} profile in new tab`}
              className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-200 ${colors.bg} ${colors.text} ${colors.border} ${colors.hover}`}
            >
              {getSocialPlatformIcon(link.platform, "h-4 w-4")}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap justify-center ${className}`}>
      {links.map((link) => {
        const colors = PLATFORM_COLOR_CLASSES[link.platform];
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border backdrop-blur-md transition-all duration-200 shadow-sm ${colors.bg} ${colors.text} ${colors.border} ${colors.hover}`}
          >
            {getSocialPlatformIcon(link.platform, "h-3.5 w-3.5 shrink-0")}
            <span>{link.label}</span>
            <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}
