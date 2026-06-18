"use client";

import { useId } from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

export function Select({
  label,
  id,
  name,
  required,
  options,
  value,
  onChange,
  error,
  placeholder = "Select an option",
  disabled,
}: {
  label?: string;
  id?: string;
  name?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const selectId = id ?? name ?? `select-${uid}`;
  const selectName = name ?? selectId;

  return (
    <div className={cn("flex w-full flex-col gap-2", disabled && "opacity-60")}>
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={selectId} className="text-sm font-medium text-ink">
            {label}
          </Label>
          {required && <span className="text-sm font-medium text-ink">*</span>}
        </div>
      )}
      <div
        className={cn(
          "flex h-11 items-center overflow-hidden rounded-md border bg-white transition-all duration-200",
          error ? "border-destructive" : "border-hairline-strong focus-within:border-2 focus-within:border-brand-blue",
          disabled && "cursor-not-allowed bg-surface"
        )}
      >
        <select
          id={selectId}
          name={selectName}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-full flex-1 appearance-none border-none bg-transparent px-4 text-base outline-none focus:ring-0",
            value ? "font-normal text-ink" : "font-normal text-steel",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value || opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none pr-4 text-steel">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
