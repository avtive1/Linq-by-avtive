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
          <Label
            htmlFor={inputId}
            className={cn(
              "font-mono text-[10px] font-normal uppercase tracking-[0.14em]",
              isLocked ? "text-text-xmuted" : "text-text-xmuted",
            )}
          >
            {label}
          </Label>
          {required && <span className="text-[10px] font-mono text-text-xmuted">*</span>}
        </div>
      )}
      <div
        className={cn(
          "flex h-11 items-center overflow-hidden rounded-lg border bg-canvas transition-all duration-200",
          error
            ? "border-destructive"
            : isLocked
              ? "border-border bg-surface"
              : "border-border focus-within:border-royal-indigo/70 focus-within:ring-4 focus-within:ring-royal-indigo/10",
          isLocked && "cursor-not-allowed"
        )}
      >
        {prefix && (
          <span className="flex h-full items-center whitespace-nowrap bg-surface px-4 text-sm font-medium text-text-muted">
            {prefix}
          </span>
        )}
        {icon && (
          <div className="shrink-0 pl-4 text-text-muted">
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
            "h-full flex-1 border-0 bg-transparent px-4 text-[15px] leading-[1.65] shadow-none ring-0 focus-visible:ring-0 placeholder:text-text-xmuted",
            isLocked ? "cursor-not-allowed text-text-muted" : "text-text-primary"
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="p-2 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-indigo/30"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
