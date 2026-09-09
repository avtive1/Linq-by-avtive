"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { Button as ShadButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PromotionChannel, PromotionTemplate } from "./types";
import { DEFAULT_TEMPLATES } from "./defaultTemplates";
import { TemplateEditorModal } from "./TemplateEditorModal";
import { SpreadsheetImportModal } from "./SpreadsheetImportModal";
import { parsePromotionImportFile, ImportResult } from "./importUtils";

interface TemplateListProps {
  channel: PromotionChannel;
  eventId?: string;
  eventName?: string;
  onBack: () => void;
  onSelectTemplate?: (tpl: PromotionTemplate) => void;
}

export function TemplateList({
  channel,
  eventId,
  eventName,
  onBack,
  onSelectTemplate,
}: TemplateListProps) {
  const [templates, setTemplates] = useState<PromotionTemplate[]>(
    DEFAULT_TEMPLATES[channel] || [],
  );
  const [selectedTemplate, setSelectedTemplate] = useState<PromotionTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Spreadsheet state if imported from list view
  const [spreadsheetState, setSpreadsheetState] = useState<{
    open: boolean;
    fileName: string;
    headers: string[];
    sampleRows: Record<string, string>[];
    totalRows: number;
  }>({
    open: false,
    fileName: "",
    headers: [],
    sampleRows: [],
    totalRows: 0,
  });

  const channelTitle =
    channel === "newsletter" ? "Newsletter" : channel === "linkedin" ? "LinkedIn" : "WhatsApp";

  const handleUseTemplate = (tpl: PromotionTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(tpl);
    } else {
      setSelectedTemplate(tpl);
      setIsEditorOpen(true);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result: ImportResult = await parsePromotionImportFile(file);

      if (result.type === "text") {
        const newTemplate: PromotionTemplate = {
          id: `custom-${Date.now()}`,
          channel,
          name: result.heading || file.name.replace(/\.[^/.]+$/, "") || "Imported Template",
          subject: result.subject || result.heading || "Imported Announcement",
          heading: result.heading || "Imported Announcement",
          message: result.message,
          theme: "default",
        };

        setTemplates((prev) => [newTemplate, ...prev.slice(0, 2)]);
        handleUseTemplate(newTemplate);
        toast.success("Document text imported into editor");
      } else if (result.type === "image") {
        const newTemplate: PromotionTemplate = {
          id: `custom-${Date.now()}`,
          channel,
          name: `Image Template (${file.name.slice(0, 15)})`,
          subject: "Announcement with image",
          heading: "New Announcement",
          message: "Check out the attached image below.",
          imageUrl: result.dataUrl,
          theme: "default",
        };

        setTemplates((prev) => [newTemplate, ...prev.slice(0, 2)]);
        handleUseTemplate(newTemplate);
        toast.success("Image template created");
      } else if (result.type === "attachment") {
        const newTemplate: PromotionTemplate = {
          id: `custom-${Date.now()}`,
          channel,
          name: `Document: ${file.name.slice(0, 20)}`,
          subject: `Document: ${file.name}`,
          heading: file.name.replace(/\.[^/.]+$/, ""),
          message: `Please find the attached document: ${file.name}`,
          attachmentUrl: result.dataUrl,
          attachmentName: result.fileName,
          theme: "default",
        };

        setTemplates((prev) => [newTemplate, ...prev.slice(0, 2)]);
        handleUseTemplate(newTemplate);
        toast.success("File attached to new template");
      } else if (result.type === "spreadsheet") {
        setSpreadsheetState({
          open: true,
          fileName: result.fileName,
          headers: result.headers,
          sampleRows: result.sampleRows,
          totalRows: result.totalRows,
        });
      } else if (result.type === "unsupported") {
        toast.error(result.message);
      }
    } catch {
      toast.error("Could not parse template file");
    } finally {
      if (e.target) e.target.value = "";
    }
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
            className="h-8 w-8 p-0 rounded-lg text-muted hover:text-heading cursor-pointer"
            aria-label="Back to channels"
          >
            <ArrowLeft size={16} />
          </ShadButton>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-heading">{channelTitle}</h2>
              {eventName && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {eventName}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">Choose a template to customize and deliver</p>
          </div>
        </div>

        {/* Hidden Import File Input */}
        <input
          ref={importInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.txt,.csv,.xlsx,.xls,.tsv,.json,.md"
          className="hidden"
          onChange={handleImportFile}
        />

        <ShadButton
          variant="outline"
          size="sm"
          onClick={() => importInputRef.current?.click()}
          className="text-xs h-8 gap-1.5 self-start sm:self-auto border-border/60 cursor-pointer"
        >
          <Upload size={13} />
          Import File
        </ShadButton>
      </div>

      {/* Exactly 3 Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            role="button"
            tabIndex={0}
            onClick={() => handleUseTemplate(tpl)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleUseTemplate(tpl);
              }
            }}
            className="group flex flex-col justify-between bg-white border border-border/60 rounded-xl p-5 hover:border-primary/60 hover:shadow-md transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 select-none"
          >
            {/* Visual Mini Preview Container */}
            <div className="mb-4 rounded-lg bg-slate-50 border border-border/40 p-3.5 h-44 overflow-hidden flex flex-col justify-between relative group-hover:bg-slate-50/80 transition-colors">
              {channel === "newsletter" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
                    <span className="text-[10px] font-bold text-primary">LINQ</span>
                    <span className="text-[9px] text-muted">Newsletter</span>
                  </div>
                  {tpl.imageUrl && (
                    <div className="w-full h-12 rounded bg-primary/10 flex items-center justify-center text-[10px] text-primary/60 overflow-hidden">
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
                  <div className="text-[9px] text-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Alex (Attendee)
                  </div>
                  <div className="bg-white border border-border/50 rounded-lg p-2.5 shadow-2xs text-[11px] text-slate-700 leading-snug line-clamp-4">
                    {tpl.message.replace(/\{\{name\}\}/gi, "Alex")}
                  </div>
                </div>
              )}

              {channel === "whatsapp" && (
                <div className="flex flex-col justify-end h-full gap-2">
                  <div className="text-[9px] text-[#075e54] font-semibold flex items-center gap-1">
                    WhatsApp Message
                  </div>
                  <div className="bg-[#d9fdd3] text-slate-800 rounded-md p-2.5 text-[11px] leading-snug line-clamp-4 shadow-2xs">
                    {tpl.message.replace(/\{\{name\}\}/gi, "Alex")}
                  </div>
                </div>
              )}

              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
            </div>

            {/* Template Info & Action */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-heading leading-tight truncate">
                  {tpl.name}
                </h3>
                <p className="text-[11px] text-muted capitalize mt-0.5">
                  {tpl.theme || "default"} theme
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ShadButton
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseTemplate(tpl);
                  }}
                  className="text-xs h-8 px-2.5 text-muted hover:text-heading cursor-pointer"
                >
                  Preview
                </ShadButton>
                <ShadButton
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseTemplate(tpl);
                  }}
                  className="text-xs h-8 font-semibold px-3.5 cursor-pointer"
                >
                  Use
                </ShadButton>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Editor Modal for Standalone Usage */}
      <TemplateEditorModal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        template={selectedTemplate}
        channel={channel}
        eventId={eventId}
        eventName={eventName}
      />

      {/* Spreadsheet Modal for List View Import */}
      <SpreadsheetImportModal
        open={spreadsheetState.open}
        onOpenChange={(isOpen) => setSpreadsheetState((prev) => ({ ...prev, open: isOpen }))}
        fileName={spreadsheetState.fileName}
        headers={spreadsheetState.headers}
        sampleRows={spreadsheetState.sampleRows}
        totalRows={spreadsheetState.totalRows}
        eventId={eventId}
        eventName={eventName}
        onUseAsContent={(headers) => {
          const tags = headers.slice(0, 3).map((h) => `{{${h}}}`).join(" ");
          const newTemplate: PromotionTemplate = {
            id: `spreadsheet-${Date.now()}`,
            channel,
            name: `Data Template (${spreadsheetState.fileName.slice(0, 15)})`,
            subject: "Update with your personalized information",
            heading: "Personalized Announcement",
            message: `Hi {{name}},\n\nHere are your event details:\n${tags}`,
            theme: "default",
          };
          setTemplates((prev) => [newTemplate, ...prev.slice(0, 2)]);
          handleUseTemplate(newTemplate);
        }}
      />
    </div>
  );
}
