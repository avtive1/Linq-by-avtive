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
          <Label htmlFor={inputId} className={cn("text-sm font-medium", isLocked ? "text-steel" : "text-ink")}>
            {label}
          </Label>
          {required && <span className="text-sm font-semibold text-ink">*</span>}
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
          "min-h-[88px] resize-none rounded-md border-hairline-strong bg-white p-4 text-base focus-visible:border-2 focus-visible:border-brand-blue focus-visible:ring-0",
          isLocked && "cursor-not-allowed bg-surface text-steel",
          error && "border-destructive"
        )}
      />
      {maxLength && (
        <p className={cn("mt-1 text-right text-xs font-medium", String(value || "").length >= maxLength ? "text-yellow-dark" : "text-steel")}>
          {String(value || "").length}/{maxLength}
        </p>
      )}
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
