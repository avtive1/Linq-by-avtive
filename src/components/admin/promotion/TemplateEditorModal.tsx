"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button as ShadButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";
import { X, Send as SendIcon, Save, Eye, Upload, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { PromotionTemplate, ChannelEditorState, PromotionChannel } from "./types";
import { NewsletterLivePreview } from "./NewsletterLivePreview";
import { LinkedInLivePreview } from "./LinkedInLivePreview";
import { WhatsAppLivePreview } from "./WhatsAppLivePreview";
import { SendConfirmDialog } from "./SendConfirmDialog";

interface TemplateEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PromotionTemplate | null;
  channel: PromotionChannel;
  onSendSuccess?: () => void;
}

export function TemplateEditorModal({
  open,
  onOpenChange,
  template,
  channel,
  onSendSuccess,
}: TemplateEditorModalProps) {
  const [form, setForm] = useState<ChannelEditorState>({
    subject: "",
    heading: "",
    message: "",
    imageUrl: "",
    attachmentUrl: "",
    caption: "",
  });

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (template) {
      setForm({
        subject: template.subject || "",
        heading: template.heading || "",
        message: template.message || "",
        imageUrl: template.imageUrl || "",
        attachmentUrl: template.attachmentUrl || "",
        caption: template.caption || "",
      });
    }
  }, [template]);

  const handleSave = () => {
    try {
      if (typeof window !== "undefined" && template) {
        localStorage.setItem(`linq_tpl_draft_${template.id}`, JSON.stringify(form));
      }
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error("File size must be under 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      toast.success("Image uploaded");
    };
    reader.readAsDataURL(file);
  };

  const executeSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/admin/promotions/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          templateId: template?.id,
          subject: form.subject,
          heading: form.heading,
          message: form.message,
          imageUrl: form.imageUrl,
          attachmentUrl: form.attachmentUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to send");
        return;
      }

      toast.success(data.message || `Sent to ${data.sentCount} attendees`);
      setIsConfirmOpen(false);
      onOpenChange(false);
      onSendSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending message";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const channelLabel =
    channel === "newsletter" ? "Newsletter" : channel === "linkedin" ? "LinkedIn" : "WhatsApp";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-5xl max-h-[92vh] bg-white border border-border/70 rounded-2xl p-0 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border/40 flex flex-row items-center justify-between shrink-0 bg-surface/30">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-md">
                {channelLabel}
              </span>
              <DialogTitle className="text-base font-semibold text-heading">
                {template?.name || "Template Editor"}
              </DialogTitle>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted hover:text-heading p-1 rounded-md transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </DialogHeader>

          {/* Two-Column Editor Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
            {/* LEFT COLUMN: Editing Controls */}
            <div className="lg:col-span-6 p-6 border-b lg:border-b-0 lg:border-r border-border/40 flex flex-col gap-4 overflow-y-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              {channel === "newsletter" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nl-subject" className="text-xs font-medium text-heading">
                      Subject
                    </Label>
                    <Input
                      id="nl-subject"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Email subject line"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nl-heading" className="text-xs font-medium text-heading">
                      Heading
                    </Label>
                    <Input
                      id="nl-heading"
                      value={form.heading}
                      onChange={(e) => setForm({ ...form, heading: e.target.value })}
                      placeholder="Main headline"
                      className="h-9 text-xs"
                    />
                  </div>
                </>
              )}

              {/* Message Field (Used by all channels) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="channel-message" className="text-xs font-medium text-heading">
                    Message
                  </Label>
                  {(channel === "linkedin" || channel === "whatsapp") && (
                    <span className="text-[10px] text-muted font-mono">Supports {"{{name}}"}</span>
                  )}
                </div>
                <ShadTextarea
                  id="channel-message"
                  rows={channel === "newsletter" ? 6 : 8}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Enter message text..."
                  className="text-xs leading-relaxed resize-y"
                />
              </div>

              {/* Image Field (Newsletter & WhatsApp) */}
              {(channel === "newsletter" || channel === "whatsapp") && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="channel-image" className="text-xs font-medium text-heading">
                    Image URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="channel-image"
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="https://... or upload"
                      className="h-9 text-xs"
                    />
                    <ShadButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 text-xs shrink-0 gap-1.5 px-3"
                    >
                      <Upload size={13} />
                      Upload
                    </ShadButton>
                  </div>
                </div>
              )}

              {/* Attachment Field (WhatsApp) */}
              {channel === "whatsapp" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wa-attachment" className="text-xs font-medium text-heading">
                    Attachment URL
                  </Label>
                  <Input
                    id="wa-attachment"
                    value={form.attachmentUrl}
                    onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                    placeholder="https://example.com/file.pdf"
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border/30 mt-auto">
                <div className="flex items-center gap-1.5">
                  <ShadButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs h-8 gap-1 text-muted hover:text-heading"
                    title="Browse local file"
                  >
                    <FolderOpen size={13} />
                    Browse
                  </ShadButton>

                  <ShadButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    className="text-xs h-8 gap-1 text-muted hover:text-heading"
                    title="Save draft"
                  >
                    <Save size={13} />
                    Save
                  </ShadButton>
                </div>

                <div className="flex items-center gap-2">
                  <ShadButton
                    type="button"
                    size="sm"
                    onClick={() => setIsConfirmOpen(true)}
                    className="text-xs h-8 font-semibold px-4 gap-1.5"
                  >
                    <SendIcon size={12} />
                    Send
                  </ShadButton>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Preview */}
            <div className="lg:col-span-6 p-6 bg-slate-50/50 flex flex-col items-center justify-center overflow-y-auto">
              <div className="w-full flex items-center justify-between mb-4 px-2">
                <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                  <Eye size={13} />
                  Live Preview
                </span>
                <span className="text-[11px] text-muted">Updates in real time</span>
              </div>

              <div className="w-full flex items-center justify-center">
                {channel === "newsletter" && (
                  <NewsletterLivePreview
                    heading={form.heading}
                    message={form.message}
                    imageUrl={form.imageUrl}
                    subject={form.subject}
                  />
                )}
                {channel === "linkedin" && (
                  <LinkedInLivePreview message={form.message} caption={form.caption} />
                )}
                {channel === "whatsapp" && (
                  <WhatsAppLivePreview
                    message={form.message}
                    imageUrl={form.imageUrl}
                    attachmentUrl={form.attachmentUrl}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Prompt */}
      <SendConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={executeSend}
        isSending={isSending}
      />
    </>
  );
}
