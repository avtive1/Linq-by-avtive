"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Clock3 } from "lucide-react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

type TimeInputProps = {
  label?: string;
  id?: string;
  name?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  disabled?: boolean;
};

function parseTime24(value: string): { hour12: string; minute: string; period: "AM" | "PM" } {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return { hour12: "12", minute: "00", period: "AM" };
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { hour12: "12", minute: "00", period: "AM" };
  }
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12Num = hour24 % 12 || 12;
  return {
    hour12: String(hour12Num).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    period,
  };
}

function toTime24(hour12: string, minute: string, period: "AM" | "PM"): string {
  const h = Number(hour12);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(m) || m < 0 || m > 59) return "";
  const hour24 = period === "PM" ? (h % 12) + 12 : h % 12;
  return `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimeInput({
  label,
  id,
  name,
  required,
  value = "",
  onChange,
  error,
  disabled,
}: TimeInputProps) {
  const uid = useId().replace(/:/g, "");
  const inputId = id ?? name ?? `time-${uid}`;
  const inputName = name ?? inputId;
  const triggerId = `${inputId}-trigger`;
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const parsed = parseTime24(value);
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const periods: Array<"AM" | "PM"> = ["AM", "PM"];

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  const commit = (hour12: string, minute: string, period: "AM" | "PM") => {
    const next = toTime24(hour12, minute, period);
    if (next) onChange?.(next);
  };

  const listBase = "custom-scrollbar h-56 w-full overflow-y-auto rounded-md border border-hairline-soft bg-surface px-1 py-1";
  const itemBase = "w-full rounded-md px-2 py-1.5 text-center text-sm font-medium leading-tight transition-all duration-200";
  const selectedItem = "scale-[1.02] border border-hairline bg-white font-semibold text-ink shadow-sm";
  const idleItem = "text-ink hover:bg-surface";
  const displayValue = `${parsed.hour12}:${parsed.minute} ${parsed.period}`;

  return (
    <div ref={wrapRef} className={cn("group relative flex w-full flex-col gap-2", disabled && "opacity-60")}>
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={triggerId} className="text-sm font-medium text-ink">
            {label}
          </Label>
          {required && <span className="text-sm font-medium text-ink">*</span>}
        </div>
      )}
      <input type="hidden" name={inputName} id={inputId} value={value} readOnly aria-hidden="true" tabIndex={-1} />
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center rounded-md border bg-white px-4 text-left shadow-sm transition-all duration-200",
          error ? "border-destructive" : "border-hairline-strong hover:border-brand-blue/50 focus-visible:border-2 focus-visible:border-brand-blue",
          disabled ? "cursor-not-allowed bg-surface" : "cursor-pointer"
        )}
      >
        <span className={cn("flex-1 text-base", value ? "text-ink" : "text-steel")}>
          {value ? displayValue : "--:-- --"}
        </span>
        <Clock3 size={18} className="text-steel transition-colors group-hover:text-ink" />
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-[120] w-[280px] rounded-lg border border-hairline bg-white p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-t border-l border-hairline bg-white" />
          <div className="relative z-10 flex h-full items-start gap-2.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="mb-1 text-center text-[11px] font-semibold tracking-wider text-steel uppercase">Hour</span>
              <div className={listBase}>
                {hours.map((h) => (
                  <button key={h} type="button" onClick={() => commit(h, parsed.minute, parsed.period)} className={cn(itemBase, "mb-0.5 last:mb-0", parsed.hour12 === h ? selectedItem : idleItem)}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="mb-1 text-center text-[11px] font-semibold tracking-wider text-steel uppercase">Min</span>
              <div className={listBase}>
                {minutes.map((m) => (
                  <button key={m} type="button" onClick={() => commit(parsed.hour12, m, parsed.period)} className={cn(itemBase, "mb-0.5 last:mb-0", parsed.minute === m ? selectedItem : idleItem)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="mb-1 text-center text-[11px] font-semibold tracking-wider text-steel uppercase">AM/PM</span>
              <div className={listBase}>
                {periods.map((p) => (
                  <button key={p} type="button" onClick={() => commit(parsed.hour12, parsed.minute, p)} className={cn(itemBase, "mb-0.5 last:mb-0", parsed.period === p ? selectedItem : idleItem)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
