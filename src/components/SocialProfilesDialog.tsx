"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AttendeeSocialLinks,
  SocialPlatform,
} from "@/types/card";
import {
  validateAndNormalizeLinkedInUrl,
  validateAndNormalizeSocialUrl,
  SUPPORTED_SOCIAL_PLATFORMS,
} from "@/lib/validation/social-urls";
import {
  LinkedInIcon,
  getSocialPlatformIcon,
  PLATFORM_LABELS,
} from "@/components/AttendeeSocialLinks";
import { CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";

interface SocialProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedin: string;
  socialLinks: AttendeeSocialLinks;
  onSave: (linkedin: string, socialLinks: AttendeeSocialLinks) => void;
  isLinkedInMandatory?: boolean;
}

const OPTIONAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "twitter",
  "github",
  "facebook",
  "youtube",
  "tiktok",
  "website",
];

const PLATFORM_PLACEHOLDERS: Record<SocialPlatform, string> = {
  linkedin: "https://linkedin.com/in/username or username",
  instagram: "instagram.com/username or @username",
  twitter: "x.com/username or @username",
  github: "github.com/username or @username",
  facebook: "facebook.com/username or profile URL",
  youtube: "youtube.com/@channel or channel URL",
  tiktok: "tiktok.com/@username or @username",
  website: "https://yourwebsite.com",
};

export function SocialProfilesDialog({
  open,
  onOpenChange,
  linkedin,
  socialLinks,
  onSave,
  isLinkedInMandatory = true,
}: SocialProfilesDialogProps) {
  const [draftLinkedIn, setDraftLinkedIn] = useState(linkedin || "");
  const [draftSocials, setDraftSocials] = useState<Record<string, string>>({});
  const [activePlatforms, setActivePlatforms] = useState<SocialPlatform[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDraftLinkedIn(linkedin || "");
      const initialDraft: Record<string, string> = {};
      const initialActive: SocialPlatform[] = [];

      OPTIONAL_PLATFORMS.forEach((platform) => {
        const val = socialLinks?.[platform];
        if (val) {
          initialDraft[platform] = val;
          initialActive.push(platform);
        } else {
          initialDraft[platform] = "";
        }
      });

      setDraftSocials(initialDraft);
      setActivePlatforms(initialActive);
      setErrors({});
    }
  }, [open, linkedin, socialLinks]);

  const handleLinkedInChange = (val: string) => {
    setDraftLinkedIn(val);
    if (errors.linkedin) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.linkedin;
        return next;
      });
    }
  };

  const handleSocialChange = (platform: SocialPlatform, val: string) => {
    setDraftSocials((prev) => ({ ...prev, [platform]: val }));
    if (errors[platform]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
    }
  };

  const addPlatform = (platform: SocialPlatform) => {
    if (!activePlatforms.includes(platform)) {
      setActivePlatforms((prev) => [...prev, platform]);
    }
  };

  const removePlatform = (platform: SocialPlatform) => {
    setActivePlatforms((prev) => prev.filter((p) => p !== platform));
    setDraftSocials((prev) => ({ ...prev, [platform]: "" }));
    if (errors[platform]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
    }
  };

  const availablePlatformsToAdd = OPTIONAL_PLATFORMS.filter(
    (p) => !activePlatforms.includes(p)
  );

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    let normalizedLinkedIn = "";

    // 1. Validate LinkedIn
    if (isLinkedInMandatory || draftLinkedIn.trim()) {
      const liResult = validateAndNormalizeLinkedInUrl(draftLinkedIn);
      if (!liResult.valid) {
        newErrors.linkedin = liResult.error || "A valid LinkedIn profile URL is required.";
      } else {
        normalizedLinkedIn = liResult.normalizedUrl || draftLinkedIn.trim();
      }
    }

    // 2. Validate optional socials
    const normalizedSocials: AttendeeSocialLinks = {};
    for (const platform of activePlatforms) {
      const val = draftSocials[platform]?.trim();
      if (val) {
        const res = validateAndNormalizeSocialUrl(platform, val);
        if (!res.valid) {
          newErrors[platform] = res.error || `Invalid ${PLATFORM_LABELS[platform]} URL or handle.`;
        } else if (res.normalizedUrl) {
          normalizedSocials[platform] = res.normalizedUrl;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(normalizedLinkedIn, normalizedSocials);
    onOpenChange(false);
  };

  // Preview validation for LinkedIn
  const liLiveCheck = draftLinkedIn.trim()
    ? validateAndNormalizeLinkedInUrl(draftLinkedIn)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto bg-neutral-900 border border-neutral-800 text-white shadow-2xl p-6">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Professional & Social Profiles
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400">
            Connect your LinkedIn profile (required for your badge) and add any optional social links for attendees to connect with you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* LinkedIn Section (Mandatory) */}
          <div className="rounded-xl bg-neutral-950/70 border border-neutral-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="linkedin-input" className="text-xs font-semibold uppercase tracking-wider text-[#70B5F9] flex items-center gap-1.5">
                <LinkedInIcon className="h-4 w-4 fill-current" />
                <span>LinkedIn Profile {isLinkedInMandatory ? "(Required)" : ""}</span>
              </Label>
              {liLiveCheck?.valid && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Valid
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Input
                id="linkedin-input"
                type="text"
                placeholder={PLATFORM_PLACEHOLDERS.linkedin}
                value={draftLinkedIn}
                onChange={(e) => handleLinkedInChange(e.target.value)}
                className={`bg-neutral-900/90 border-neutral-700 text-white placeholder:text-neutral-500 text-sm h-10 ${
                  errors.linkedin ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
              />
              <p className="text-[11px] text-neutral-400">
                Accepts full URLs (e.g. <code>https://linkedin.com/in/username</code>) or username/handle.
              </p>
            </div>

            {errors.linkedin && (
              <Alert variant="destructive" className="py-2 px-3 bg-red-950/40 border-red-800/60 text-red-300">
                <AlertCircle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">{errors.linkedin}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Optional Additional Socials */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Additional Social Profiles (Optional)
              </span>
            </div>

            {/* Active Platform Inputs */}
            {activePlatforms.length > 0 ? (
              <div className="space-y-3">
                {activePlatforms.map((platform) => {
                  const error = errors[platform];
                  return (
                    <div
                      key={platform}
                      className="rounded-xl bg-neutral-950/50 border border-neutral-800/80 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`social-${platform}`}
                          className="text-xs font-medium text-neutral-300 flex items-center gap-2"
                        >
                          <span className="text-neutral-400">{getSocialPlatformIcon(platform, "h-3.5 w-3.5")}</span>
                          <span>{PLATFORM_LABELS[platform]}</span>
                        </Label>
                        <button
                          type="button"
                          onClick={() => removePlatform(platform)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                          title={`Remove ${PLATFORM_LABELS[platform]}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <Input
                        id={`social-${platform}`}
                        type="text"
                        placeholder={PLATFORM_PLACEHOLDERS[platform]}
                        value={draftSocials[platform] || ""}
                        onChange={(e) => handleSocialChange(platform, e.target.value)}
                        className={`bg-neutral-900/90 border-neutral-700 text-white placeholder:text-neutral-500 text-xs h-9 ${
                          error ? "border-red-500" : ""
                        }`}
                      />

                      {error && (
                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 px-3 rounded-xl border border-dashed border-neutral-800 bg-neutral-950/30 text-xs text-neutral-400">
                No additional social accounts added yet. Select a platform below to connect.
              </div>
            )}

            {/* Add Platform Chips */}
            {availablePlatformsToAdd.length > 0 && (
              <div className="pt-1 space-y-2">
                <span className="text-[11px] text-neutral-400 block">Add platform:</span>
                <div className="flex flex-wrap gap-1.5">
                  {availablePlatformsToAdd.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => addPlatform(platform)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      {getSocialPlatformIcon(platform, "h-3 w-3")}
                      <span>{PLATFORM_LABELS[platform]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 pt-2 border-t border-neutral-800">
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                className="text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs"
              >
                Cancel
              </Button>
            }
          />
          <Button
            type="button"
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4"
          >
            Save Profiles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SocialProfilesSummaryProps {
  linkedin: string;
  socialLinks: AttendeeSocialLinks;
  error?: string;
  onOpenDialog: () => void;
  isMandatory?: boolean;
}

export function SocialProfilesSummary({
  linkedin,
  socialLinks,
  error,
  onOpenDialog,
  isMandatory = true,
}: SocialProfilesSummaryProps) {
  const hasLinkedIn = Boolean(linkedin && linkedin.trim());
  const connectedSocials = Object.entries(socialLinks || {}).filter(
    ([, url]) => Boolean(url && url.trim())
  ) as [SocialPlatform, string][];

  // Helper to extract a display-friendly handle
  const getDisplayHandle = (url: string) => {
    try {
      const clean = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      const parts = clean.split("/");
      return parts[parts.length - 1] || clean;
    } catch {
      return url;
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-heading flex items-center gap-1.5">
          <span>Social & Professional Profiles</span>
          {isMandatory && <span className="text-primary-strong">*</span>}
        </Label>
        {hasLinkedIn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenDialog}
            className="h-7 text-xs text-primary hover:text-primary-strong p-0 hover:bg-transparent cursor-pointer"
          >
            Manage Profiles
          </Button>
        )}
      </div>

      <div
        className={`rounded-xl p-3.5 transition-all border ${
          error
            ? "border-red-500/80 bg-red-950/20 shadow-sm shadow-red-950/30"
            : hasLinkedIn
            ? "border-border/60 bg-neutral-900/40"
            : "border-dashed border-border/80 bg-neutral-900/20 hover:border-primary/50 hover:bg-neutral-900/40"
        }`}
      >
        {hasLinkedIn ? (
          <div className="space-y-3">
            {/* LinkedIn Active Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-[#0A66C2]/15 text-[#70B5F9] border border-[#0A66C2]/30 flex items-center justify-center shrink-0">
                  <LinkedInIcon className="h-4 w-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">LinkedIn Connected</span>
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate max-w-[220px] sm:max-w-[280px]">
                    {getDisplayHandle(linkedin)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenDialog}
                className="h-7 text-xs px-2.5 rounded-lg border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 shrink-0 cursor-pointer"
              >
                Edit
              </Button>
            </div>

            {/* Other Connected Socials Pills */}
            {connectedSocials.length > 0 && (
              <div className="pt-2 border-t border-neutral-800/60 flex flex-wrap gap-1.5">
                {connectedSocials.map(([platform, url]) => (
                  <span
                    key={platform}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-neutral-800/60 border border-neutral-700/50 text-neutral-300"
                  >
                    {getSocialPlatformIcon(platform, "h-3 w-3")}
                    <span>{PLATFORM_LABELS[platform]}: @{getDisplayHandle(url)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#0A66C2]/15 text-[#70B5F9] border border-[#0A66C2]/30 flex items-center justify-center shrink-0">
                <LinkedInIcon className="h-5 w-5 fill-current" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  Connect LinkedIn Profile {isMandatory ? "(Required)" : ""}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Required for your badge QR code and attendee networking.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onOpenDialog}
              className="h-8 text-xs font-medium px-3 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white shrink-0 shadow-md cursor-pointer"
            >
              Connect Profile
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="px-3 py-2 bg-red-950/40 border-red-800/60 text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
