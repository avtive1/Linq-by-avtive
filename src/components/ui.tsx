"use client";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ChevronRight } from "lucide-react";

type InputProps = {
  label?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  prefix?: string;
  icon?: "email" | "lock";
  error?: string;
};

export function TextInput({
  label,
  required,
  type = "text",
  placeholder,
  value,
  onChange,
  prefix,
  icon,
  error,
}: InputProps) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPass ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5 w-full group">
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-heading leading-none">
            {label}
          </label>
          {required && <span className="text-primary text-sm font-bold">*</span>}
        </div>
      )}
      <div 
        className={`
          flex items-center bg-white border rounded-xl shadow-sm transition-all focus-within:ring-2 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
            : "border-border focus-within:ring-primary/20 focus-within:border-primary"}
        `}
      >
        {prefix && (
          <div className="flex items-center">
            <span className="px-3 text-sm text-muted bg-surface/50 whitespace-nowrap">
              {prefix}
            </span>
            <div className="w-[1px] h-10 bg-border" />
          </div>
        )}
        <div className="pl-4 flex-shrink-0 text-muted">
          {icon === "email" && <Mail size={18} />}
          {icon === "lock" && <Lock size={18} />}
        </div>
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm text-heading bg-transparent outline-none placeholder:text-muted/60"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="p-2.5 text-muted hover:text-heading transition-colors"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-[11px] font-medium text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  type?: "button" | "submit";
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth,
  type = "button",
  icon,
  className = "",
  disabled,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  };

  return (
    <button
      type={type}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.98]
        ${sizeClasses[size]}
        ${isPrimary 
          ? "bg-primary text-white shadow-[0_1px_2px_rgba(37,62,167,0.4),0_0_0_1px_#375dfb] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100" 
          : "bg-white border border-border text-muted hover:border-muted/40 hover:text-heading disabled:opacity-50 disabled:cursor-not-allowed"}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `}
    >
      <span>{children}</span>
      {icon || (isPrimary && <ChevronRight size={size === "lg" ? 18 : 16} />)}
    </button>
  );
}

export function Select({
  label,
  required,
  options,
  value,
  onChange,
  error,
  placeholder = "Select an option",
  disabled,
}: {
  label?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 w-full group ${disabled ? "opacity-60" : ""}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-heading leading-none">
            {label}
          </label>
          {required && <span className="text-primary text-sm font-bold">*</span>}
        </div>
      )}
      <div 
        className={`
          flex items-center bg-white border rounded-xl shadow-sm transition-all focus-within:ring-2 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
            : "border-border focus-within:ring-primary/20 focus-within:border-primary"}
          ${disabled ? "bg-surface/50 cursor-not-allowed" : ""}
        `}
      >
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`
            flex-1 px-3 py-2.5 text-sm text-heading bg-transparent outline-none placeholder:text-muted/60 appearance-none
            ${disabled ? "cursor-not-allowed" : "cursor-pointer"}
          `}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value || opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pr-4 pointer-events-none text-muted">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {error && <p className="text-[11px] font-medium text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

export function FilePicker({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label?: string;
  value?: string;
  onChange: (base64: string) => void;
  required?: boolean;
  error?: string;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-heading">
            {label}
          </label>
          {required && <span className="text-primary text-sm font-bold">*</span>}
        </div>
      )}
      <div className={`
        relative flex items-center bg-white border rounded-xl shadow-sm overflow-hidden transition-all
        ${error ? "border-red-500" : "border-border hover:border-muted/40"}
      `}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        <div className="flex-1 px-4 py-2.5 text-sm text-muted/60 truncate">
          {value ? "Photo selected" : "Choose File"}
        </div>
        <div className="px-4 py-2.5 bg-surface border-l border-border text-xs font-semibold text-muted">
          Browse
        </div>
      </div>
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
