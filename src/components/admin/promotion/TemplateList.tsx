"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Upload, FileText, Check } from "lucide-react";
import { Button as ShadButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PromotionChannel, PromotionTemplate } from "./types";
import { DEFAULT_TEMPLATES } from "./defaultTemplates";
import { TemplateEditorModal } from "./TemplateEditorModal";

interface TemplateListProps {
  channel: PromotionChannel;
  onBack: () => void;
}

export function TemplateList({ channel, onBack }: TemplateListProps) {
  const [templates, setTemplates] = useState<PromotionTemplate[]>(
    DEFAULT_TEMPLATES[channel] || [],
  );
  const [selectedTemplate, setSelectedTemplate] = useState<PromotionTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const channelTitle =
    channel === "newsletter" ? "Newsletter" : channel === "linkedin" ? "LinkedIn" : "WhatsApp";

  const handleUseTemplate = (tpl: PromotionTemplate) => {
    setSelectedTemplate(tpl);
    setIsEditorOpen(true);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        let importedTpl: Partial<PromotionTemplate>;
        try {
          importedTpl = JSON.parse(text);
        } catch {
          // If plain text or HTML, treat as message body
          importedTpl = {
            name: file.name.replace(/\.[^/.]+$/, ""),
            message: text,
          };
        }

        const newTemplate: PromotionTemplate = {
          id: `custom-${Date.now()}`,
          channel,
          name: importedTpl.name || "Imported Template",
          subject: importedTpl.subject || "Imported Message",
          heading: importedTpl.heading || importedTpl.name || "Imported Announcement",
          message: importedTpl.message || text,
          imageUrl: importedTpl.imageUrl || "",
          attachmentUrl: importedTpl.attachmentUrl || "",
          caption: importedTpl.caption || "",
        };

        setTemplates((prev) => [newTemplate, ...prev.slice(0, 2)]);
        setSelectedTemplate(newTemplate);
        setIsEditorOpen(true);
        toast.success("Template imported");
      } catch {
        toast.error("Could not parse template file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in text-left">
      {/* Top Bar with Back & Channel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <ShadButton
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 rounded-lg text-muted hover:text-heading"
            aria-label="Back to channels"
          >
            <ArrowLeft size={16} />
          </ShadButton>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-heading">{channelTitle}</h2>
            <p className="text-xs text-muted">Choose a template</p>
          </div>
        </div>

        {/* Hidden Import File Input */}
        <input
          ref={importInputRef}
          type="file"
          accept=".json,.txt,.html,.md"
          className="hidden"
          onChange={handleImportFile}
        />

        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => importInputRef.current?.click()}
          className="text-xs h-8 gap-1.5 self-start sm:self-auto border-border/60"
        >
          <Upload size={13} />
          Import
        </ShadButton>
      </div>

      {/* Exactly 3 Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className="group flex flex-col justify-between bg-white border border-border/60 rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
          >
            {/* Visual Mini Preview Container */}
            <div className="mb-4 rounded-lg bg-slate-50 border border-border/40 p-4 h-48 overflow-hidden flex flex-col justify-between select-none relative group-hover:bg-slate-50/80 transition-colors">
              {channel === "newsletter" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-border/30 pb-2">
                    <span className="text-[10px] font-bold text-primary">LINQ</span>
                    <span className="text-[9px] text-muted">Newsletter</span>
                  </div>
                  {tpl.imageUrl && (
                    <div className="w-full h-14 rounded bg-primary/10 flex items-center justify-center text-[10px] text-primary/60 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tpl.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-heading truncate">{tpl.heading}</p>
                  <p className="text-[10px] text-muted line-clamp-2 leading-relaxed">
                    {tpl.message}
                  </p>
                </div>
              )}

              {channel === "linkedin" && (
                <div className="flex flex-col justify-end h-full gap-2">
                  <div className="text-[9px] text-muted flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Alex (Attendee)
                  </div>
                  <div className="bg-white border border-border/50 rounded-lg p-2.5 shadow-2xs text-[11px] text-slate-700 leading-snug line-clamp-4">
                    {tpl.message.replace(/\{\{name\}\}/gi, "Alex")}
                  </div>
                </div>
              )}

              {channel === "whatsapp" && (
                <div className="flex flex-col justify-end h-full gap-2">
                  <div className="text-[9px] text-[#075e54] font-medium flex items-center gap-1">
                    WhatsApp Message
                  </div>
                  <div className="bg-[#d9fdd3] text-slate-800 rounded-md p-2 text-[11px] leading-snug line-clamp-4 shadow-2xs">
                    {tpl.message.replace(/\{\{name\}\}/gi, "Alex")}
                  </div>
                </div>
              )}

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {/* Template Info & Action */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div>
                <h3 className="text-sm font-semibold text-heading leading-tight">{tpl.name}</h3>
              </div>

              <div className="flex items-center gap-1.5">
                {(channel === "linkedin" || channel === "whatsapp") && (
                  <ShadButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUseTemplate(tpl)}
                    className="text-xs h-8 px-2.5 text-muted hover:text-heading"
                  >
                    Preview
                  </ShadButton>
                )}
                <ShadButton
                  size="sm"
                  onClick={() => handleUseTemplate(tpl)}
                  className="text-xs h-8 font-semibold px-4"
                >
                  Use
                </ShadButton>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Editor Modal */}
      <TemplateEditorModal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        template={selectedTemplate}
        channel={channel}
      />
    </div>
  );
}
