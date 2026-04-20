"use client";

import { TextInput, FilePicker, Button } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";
import type { SponsorFormRow } from "@/lib/sponsors";
import { MAX_EVENT_SPONSORS } from "@/lib/sponsors";

type Props = {
  rows: SponsorFormRow[];
  onChange: (rows: SponsorFormRow[]) => void;
  onFileError?: (msg: string) => void;
  disabled?: boolean;
};

export function EventSponsorsForm({ rows, onChange, onFileError, disabled }: Props) {
  const setRow = (index: number, patch: Partial<SponsorFormRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    if (rows.length >= MAX_EVENT_SPONSORS) return;
    onChange([...rows, { name: "", logo: "" }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted leading-snug">
          Add up to {MAX_EVENT_SPONSORS} sponsors. Each needs a name and logo. Logos appear on horizontal and vertical attendee cards.
        </p>
      </div>

      <div className="flex flex-col gap-4 max-h-[min(52vh,420px)] overflow-y-auto pr-1">
        {rows.length === 0 && (
          <p className="text-xs text-muted/80 italic py-2">No sponsor slots yet. Use &quot;Add sponsor&quot; to start.</p>
        )}
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-lg border border-border/70 bg-white/60 p-4 flex flex-col gap-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-heading/70 uppercase tracking-wider">Sponsor {index + 1}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeRow(index)}
                className="p-2 rounded-md text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors disabled:opacity-40"
                aria-label={`Remove sponsor ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <TextInput
              label="Sponsor name"
              placeholder="e.g. Acme Corporation"
              value={row.name}
              onChange={(v) => setRow(index, { name: v })}
              readOnly={disabled}
            />
            <FilePicker
              label="Logo image"
              value={row.logo}
              onChange={(v) => setRow(index, { logo: v })}
              onError={onFileError}
              freeFormCrop
              cropTitle="Crop sponsor logo"
              cropSubtitle="Resize the box to any shape—drag corners or edges, then move the selection."
              cropApplyLabel="Apply logo"
            />
          </div>
        ))}
      </div>

      {rows.length < MAX_EVENT_SPONSORS && (
        <Button type="button" variant="secondary" onClick={addRow} disabled={disabled} icon={<Plus size={18} />}>
          Add sponsor ({rows.length}/{MAX_EVENT_SPONSORS})
        </Button>
      )}
    </div>
  );
}
