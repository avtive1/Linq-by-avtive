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
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.98]
        ${sizeClasses[size]}
        ${isPrimary 
          ? "bg-primary text-white shadow-[0_1px_2px_rgba(37,62,167,0.4),0_0_0_1px_#375dfb] hover:opacity-90" 
          : "bg-white border border-border text-muted hover:border-muted/40 hover:text-heading"}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `}
    >
      <span>{children}</span>
      {icon || (isPrimary && <ChevronRight size={size === "lg" ? 18 : 16} />)}
    </button>
  );
}
