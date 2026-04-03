"use client";
import { useState, useEffect, useRef } from "react";
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
          flex items-center bg-white border rounded-xl shadow-sm transition-all duration-300 focus-within:ring-2 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
            : "border-border/60 focus-within:ring-primary/30 focus-within:border-primary"}
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
          className="flex-1 px-3 py-2 text-sm text-heading bg-transparent outline-none placeholder:text-muted/60"
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
  variant?: "primary" | "secondary" | "blue";
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
  const isBlue = variant === "blue";
  
  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-[10px]",
    md: "px-4 py-2 text-[12px]",
    lg: "px-6 py-2.5 text-sm",
  };

  return (
    <button
      type={type}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 active:scale-95
        ${sizeClasses[size]}
        ${isPrimary 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100" 
          : isBlue
          ? "bg-heading text-white shadow-lg shadow-heading/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-heading/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"
          : "bg-white border border-border text-heading hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `}
    >
      <span>{children}</span>
      {icon || ((isPrimary || isBlue) && <ChevronRight size={size === "lg" ? 18 : 16} />)}
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
          flex items-center bg-white border rounded-xl shadow-sm transition-all duration-300 focus-within:ring-2 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500" 
            : "border-border/60 focus-within:ring-primary/30 focus-within:border-primary"}
          ${disabled ? "bg-surface/50 cursor-not-allowed" : ""}
        `}
      >
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`
            flex-1 px-3 py-2 text-[12px] text-heading bg-transparent outline-none placeholder:text-muted/60 appearance-none
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
        relative flex items-center bg-white border rounded-xl shadow-sm overflow-hidden transition-all duration-300
        ${error ? "border-red-500" : "border-border/60 hover:border-primary/40 hover:bg-white"}
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

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted/20 rounded-xl ${className}`}>
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function AnimatedCounter({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = countRef.current;
    const endValue = value;
    startTimeRef.current = null;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(startValue + (endValue - startValue) * ease);
      
      setDisplayValue(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        countRef.current = endValue;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

