"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CardData } from "@/types/card";
import {
  buildCardLinkedInSharePost,
  buildPublicCardShareLandingUrl,
} from "@/lib/share/linkedin-card-share";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Share2,
  Sparkles,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface LinkedInShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData;
  shareToken?: string;
  onManualShareFallback?: () => void;
  onEnsurePreviewUploaded?: () => Promise<string | undefined>;
}

function LinkedInIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64a1.65 1.65 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.65 1.65 0 0 0 1.65-1.66 1.66 1.66 0 0 0-1.65-1.66" />
    </svg>
  );
}

export function LinkedInShareDialog({
  isOpen,
  onClose,
  card,
  shareToken,
  onManualShareFallback,
  onEnsurePreviewUploaded,
}: LinkedInShareDialogProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [memberName, setMemberName] = useState<string>("");
  const [memberPicture, setMemberPicture] = useState<string>("");

  const [clientOrigin, setClientOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setClientOrigin(window.location.origin);
    }
  }, []);

  const defaultCommentary = useMemo(() => {
    if (!card) return "";
    const publicUrl = buildPublicCardShareLandingUrl(card.id, clientOrigin || undefined);

    return buildCardLinkedInSharePost({
      name: card.name,
      eventName: card.eventName,
      role: card.role,
      company: card.company,
      shareUrl: publicUrl,
      cardRole: card.cardRole,
      organizationName: card.organizationName,
    });
  }, [card, clientOrigin]);

  const [customCommentary, setCustomCommentary] = useState<string | null>(null);
  const commentary = customCommentary !== null ? customCommentary : defaultCommentary;

  const [isPosting, setIsPosting] = useState(false);
  const [postingStep, setPostingStep] = useState<string>("Preparing your LinkedIn post...");
  const [postUrl, setPostUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch connection status
  const checkStatus = useCallback(async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch("/api/share/linkedin/status", { cache: "no-store" });
      const data = await res.json();
      setIsConnected(Boolean(data.connected));
      if (data.connected && data.memberName) {
        setMemberName(String(data.memberName));
        setMemberPicture(String(data.memberPicture || ""));
      } else {
        setMemberName("");
        setMemberPicture("");
      }
    } catch {
      setIsConnected(false);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    fetch("/api/share/linkedin/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setIsConnected(Boolean(data.connected));
        if (data.connected && data.memberName) {
          setMemberName(String(data.memberName));
          setMemberPicture(String(data.memberPicture || ""));
        } else {
          setMemberName("");
          setMemberPicture("");
        }
        setCheckingAuth(false);
      })
      .catch(() => {
        if (!cancelled) {
          setIsConnected(false);
          setCheckingAuth(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Listen for OAuth completion from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "LINKEDIN_AUTH_SUCCESS") {
        toast.success("LinkedIn account connected!");
        void checkStatus();
      } else if (event.data?.type === "LINKEDIN_AUTH_ERROR") {
        setErrorMessage(String(event.data?.error || "LinkedIn authorization was cancelled or failed."));
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [checkStatus]);

  // Handle Disconnect
  const handleDisconnect = async () => {
    try {
      await fetch("/api/share/linkedin/disconnect", { method: "POST" });
      setIsConnected(false);
      setMemberName("");
      setMemberPicture("");
      toast.success("LinkedIn account disconnected.");
    } catch {
      toast.error("Failed to disconnect account.");
    }
  };

  // Start LinkedIn OAuth
  const handleConnect = () => {
    setErrorMessage("");
    const params = new URLSearchParams({
      cardId: card.id,
      popup: "true",
    });
    if (shareToken) {
      params.set("shareToken", shareToken);
    }

    const authUrl = `/api/share/linkedin/authorize?${params.toString()}`;
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "linkedin_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      // Popup blocked, fallback to normal redirect
      const directParams = new URLSearchParams({ cardId: card.id });
      if (shareToken) directParams.set("shareToken", shareToken);
      window.location.href = `/api/share/linkedin/authorize?${directParams.toString()}`;
    }
  };

  // Publish image post to LinkedIn
  const handleShare = async () => {
    if (isPosting) return;
    setIsPosting(true);
    setErrorMessage("");
    setIsSuccess(false);

    try {
      setPostingStep("Preparing your LinkedIn post...");

      // If card preview hasn't been uploaded yet, ensure it is generated & uploaded to Cloudinary
      if (onEnsurePreviewUploaded) {
        try {
          await onEnsurePreviewUploaded();
        } catch {
          // Non-blocking if already exists on server
        }
      }

      setPostingStep("Uploading attendee card...");

      const res = await fetch("/api/share/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          shareToken: shareToken || undefined,
          commentary: commentary.trim(),
        }),
      });

      setPostingStep("Publishing to LinkedIn...");

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "AUTH_REQUIRED" || data.code === "AUTH_EXPIRED") {
          setIsConnected(false);
          setErrorMessage(data.error || "Please connect your LinkedIn account first.");
          return;
        }
        throw new Error(data.error || `Share failed (${res.status})`);
      }

      setPostingStep("Successfully posted to LinkedIn");
      setPostUrl(String(data.postUrl || "https://www.linkedin.com/feed/"));
      setIsSuccess(true);
      toast.success("Successfully posted to LinkedIn");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "LinkedIn post could not be created.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPosting && onClose()}>
      <DialogContent
        className="w-full max-w-lg bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-xl p-6 sm:p-7 rounded-2xl"
        showCloseButton={!isPosting}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white shadow-md shadow-[#0A66C2]/20">
              <LinkedInIcon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-white">
                Share on LinkedIn
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Publish your attendee card directly to your LinkedIn feed as an image post.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center text-center py-6 gap-5 animate-in fade-in-50 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-white">
                Successfully posted to LinkedIn
              </h3>
              <p className="text-xs text-slate-300 max-w-sm">
                Your attendee card image and commentary have been published directly to your LinkedIn feed.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mt-2">
              <Button
                type="button"
                onClick={() => window.open(postUrl, "_blank", "noopener,noreferrer")}
                className="flex-1 bg-[#0A66C2] hover:bg-[#004182] text-white font-medium text-sm gap-2 h-10 shadow-lg shadow-[#0A66C2]/25"
              >
                <ExternalLink size={16} />
                View on LinkedIn
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-200 h-10"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {/* Error banner */}
            {errorMessage && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{errorMessage}</p>
                  {onManualShareFallback && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onManualShareFallback();
                      }}
                      className="text-xs underline hover:text-rose-100 transition-colors"
                    >
                      Share manually on LinkedIn instead &rarr;
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Post Preview (Card Image + Caption) */}
            <div className="flex flex-col gap-2 rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium pb-1 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-400" />
                  Post Image Attachment
                </span>
                <span className="text-[11px] text-emerald-400/90 font-mono">
                  Full Attendee Badge
                </span>
              </div>

              {card.cardPreviewUrl ? (
                <div className="relative w-full aspect-[1200/628] rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.cardPreviewUrl}
                    alt={`${card.name}'s badge`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-28 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center text-xs text-slate-400 gap-1">
                  <span>Badge render will be captured & attached to post</span>
                  <span className="text-[10px] text-slate-500">{card.name} · {card.eventName}</span>
                </div>
              )}

              {/* Caption edit area */}
              <div className="space-y-1 mt-1">
                <label className="text-[11px] font-medium text-slate-400">Post Caption / Commentary</label>
                <textarea
                  value={commentary}
                  onChange={(e) => setCustomCommentary(e.target.value)}
                  disabled={isPosting}
                  rows={4}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700/80 p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans leading-relaxed"
                  placeholder="Add your LinkedIn caption..."
                />
              </div>
            </div>

            {/* LinkedIn Account Connection Status */}
            {checkingAuth ? (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                <Loader2 size={16} className="animate-spin text-slate-500" />
                Checking LinkedIn status...
              </div>
            ) : isConnected ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  {memberPicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={memberPicture}
                      alt={memberName}
                      className="w-8 h-8 rounded-full border border-slate-600"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#0A66C2] text-white flex items-center justify-center text-xs font-bold">
                      {memberName ? memberName.charAt(0).toUpperCase() : "in"}
                    </div>
                  )}
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-white">
                      {memberName || "Connected LinkedIn Profile"}
                    </p>
                    <p className="text-[11px] text-emerald-400 font-medium">Ready to post</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isPosting}
                  className="h-7 text-xs text-slate-400 hover:text-rose-400 gap-1 hover:bg-slate-800/80"
                >
                  <LogOut size={12} />
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col gap-2.5">
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-white mb-0.5">Connect LinkedIn to share your attendee card.</p>
                  Connect your LinkedIn account so LINQ can upload your card image and publish it directly to your feed.
                </div>
                <Button
                  type="button"
                  onClick={handleConnect}
                  className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold h-9 gap-2 shadow-md shadow-[#0A66C2]/20"
                >
                  <LinkedInIcon className="w-4 h-4" />
                  Connect LinkedIn
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {onManualShareFallback ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManualShareFallback();
                  }}
                  disabled={isPosting}
                  className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
                >
                  Share manually on LinkedIn
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isPosting}
                  className="text-slate-300 hover:text-white text-xs h-9"
                >
                  Cancel
                </Button>

                {isConnected ? (
                  <Button
                    type="button"
                    onClick={handleShare}
                    disabled={isPosting || !commentary.trim()}
                    className="bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold h-9 px-4 gap-2 shadow-lg shadow-[#0A66C2]/20 min-w-[140px]"
                  >
                    {isPosting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        <span>Share to LinkedIn</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleConnect}
                    disabled={isPosting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9 px-4 gap-1.5 min-w-[130px]"
                  >
                    <LinkedInIcon className="w-3.5 h-3.5" />
                    Connect & Share
                  </Button>
                )}
              </div>
            </div>

            {/* Step status message while posting */}
            {isPosting && (
              <div className="flex items-center justify-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 py-2 px-3 rounded-lg animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span>{postingStep}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
