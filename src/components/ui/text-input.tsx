"use client";

import { useState, useId } from "react";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { Label } from "./label";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type InputProps = {
  label?: string;
  id?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  prefix?: string;
  icon?: "email" | "lock" | "user";
  className?: string;
  autoComplete?: string;
  name?: string;
  error?: string;
  readOnly?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  maxLength?: number;
  disabled?: boolean;
  min?: string;
};

export function TextInput({
  label,
  id,
  required,
  type = "text",
  placeholder,
  value,
  onChange,
  prefix,
  icon,
  error,
  className = "",
  autoComplete,
  name,
  readOnly,
  onFocus,
  maxLength,
  disabled,
  min,
}: InputProps) {
  const uid = useId().replace(/:/g, "");
  const inputId = id ?? name ?? `field-${uid}`;
  const inputName = name ?? inputId;
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPass ? "text" : "password") : type;
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
      <div
        className={cn(
          "flex h-11 items-center overflow-hidden rounded-md border bg-white transition-all duration-200",
          error ? "border-destructive" : isLocked ? "border-hairline bg-surface" : "border-hairline-strong focus-within:border-2 focus-within:border-brand-blue",
          isLocked && "cursor-not-allowed"
        )}
      >
        {prefix && (
          <span className="flex h-full items-center whitespace-nowrap bg-surface px-4 text-sm font-medium text-steel">
            {prefix}
          </span>
        )}
        {icon && (
          <div className="shrink-0 pl-4 text-steel">
            {icon === "email" && <Mail size={18} />}
            {icon === "lock" && <Lock size={18} />}
            {icon === "user" && <User size={18} />}
          </div>
        )}
        <Input
          id={inputId}
          name={inputName}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          autoComplete={autoComplete}
          readOnly={readOnly}
          disabled={disabled}
          onFocus={onFocus}
          maxLength={maxLength}
          min={min}
          className={cn(
            "h-full flex-1 border-0 bg-transparent px-4 text-base shadow-none ring-0 focus-visible:ring-0 placeholder:text-muted",
            isLocked ? "cursor-not-allowed text-steel" : "text-ink"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="p-2 text-steel transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
