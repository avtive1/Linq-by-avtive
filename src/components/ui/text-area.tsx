"use client";

import { useId } from "react";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { cn } from "@/lib/utils";

type InputProps = {
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
  name?: string;
  error?: string;
  readOnly?: boolean;
  maxLength?: number;
  disabled?: boolean;
  rows?: number;
};

export function TextArea({
  label,
  id,
  name,
  required,
  placeholder,
  value,
  onChange,
  error,
  className = "",
  readOnly,
  maxLength,
  disabled,
  rows = 2,
}: InputProps) {
  const uid = useId().replace(/:/g, "");
  const inputId = id ?? name ?? `field-${uid}`;
  const inputName = name ?? inputId;
  const isLocked = Boolean(disabled || readOnly);

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center gap-1">
          <Label
            htmlFor={inputId}
            className={cn(
              "font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-text-xmuted",
              isLocked && "text-text-xmuted",
            )}
          >
            {label}
          </Label>
          {required && <span className="text-[10px] font-mono text-text-xmuted">*</span>}
        </div>
      )}
      <Textarea
        id={inputId}
        name={inputName}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={disabled}
        maxLength={maxLength}
        className={cn(
          "min-h-[88px] resize-none rounded-lg border border-border bg-canvas p-4 text-[15px] leading-[1.65] text-text-primary focus-visible:border-royal-indigo/70 focus-visible:ring-4 focus-visible:ring-royal-indigo/10",
          isLocked && "cursor-not-allowed bg-surface text-text-muted",
          error && "border-destructive"
        )}
      />
      {maxLength && (
        <p
          className={cn(
            "mt-1 text-right text-xs font-medium",
            String(value || "").length >= maxLength ? "text-text-muted" : "text-text-xmuted",
          )}
        >
          {String(value || "").length}/{maxLength}
        </p>
      )}
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
