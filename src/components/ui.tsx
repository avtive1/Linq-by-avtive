"use client";
import { useState, useEffect, useRef } from "react";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { ImageCropperModal } from "./ImageCropperModal";


const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type InputProps = {
  label?: string;
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
  className = "",
  autoComplete,
  name,
  readOnly,
  onFocus,
}: InputProps) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPass ? "text" : "password") : type;

  return (
    <div className={`flex flex-col gap-2 w-full group ${className}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold text-heading leading-tight">
            {label}
          </label>
          {required && <span className="text-primary-strong text-sm font-bold">*</span>}
        </div>
      )}
      <div 
        className={`
          flex items-center bg-white border rounded-md shadow-sm transition-all duration-200 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:border-red-500" 
            : "border-border/60 focus-within:border-primary/80 focus-within:border-[1.5px]"}
        `}
      >
        {prefix && (
          <div className="flex items-center h-full">
            <span className="px-3 text-sm text-muted bg-surface/50 whitespace-nowrap h-full flex items-center">
              {prefix}
            </span>
          </div>
        )}
        <div className="pl-4 flex-shrink-0 text-muted">
          {icon === "email" && <Mail size={18} />}
          {icon === "lock" && <Lock size={18} />}
          {icon === "user" && <User size={18} />}
        </div>
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          autoComplete={autoComplete}
          name={name}
          readOnly={readOnly}
          onFocus={onFocus}
          className="flex-1 px-3 py-3 text-sm leading-6 text-heading bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted/70"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="p-2 text-muted hover:text-heading transition-colors duration-150 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium leading-snug text-red-500 mt-0.5">{error}</p>}
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
    sm: "h-9 px-3 text-xs rounded-[4px]",
    md: "h-10 px-4 text-sm rounded-sm",
    lg: "h-12 px-5 text-base rounded-md",
  };

  return (
    <button
      type={type}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2
        ${sizeClasses[size]}
        ${isPrimary 
          ? "bg-primary text-primary-foreground border border-primary shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-55 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100" 
          : isBlue
          ? "bg-heading text-white border border-heading shadow-lg shadow-heading/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-heading/30 disabled:opacity-55 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"
          : "bg-white border border-border text-heading hover:text-primary-strong hover:border-primary/60 hover:bg-primary/10 disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `}
    >
      <span>{children}</span>
      {icon}
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
    <div className={`flex flex-col gap-2 w-full group ${disabled ? "opacity-60" : ""}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold text-heading leading-tight">
            {label}
          </label>
          {required && <span className="text-primary-strong text-sm font-bold">*</span>}
        </div>
      )}
      <div 
        className={`
          flex items-center bg-white border rounded-md shadow-sm transition-all duration-200 overflow-hidden
          ${error 
            ? "border-red-500 focus-within:border-red-500" 
            : "border-border/60 focus-within:border-primary/80 focus-within:border-[1.5px]"}
          ${disabled ? "bg-surface/50 cursor-not-allowed" : ""}
        `}
      >
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`
            flex-1 px-3 py-3 text-sm leading-6 text-heading bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted/70 appearance-none
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
      {error && <p className="text-xs font-medium leading-snug text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

export function FilePicker({
  label,
  value,
  onChange,
  onError,
  required,
  error,
}: {
  label?: string;
  value?: string;
  onChange: (base64: string) => void;
  onError?: (message: string) => void;
  required?: boolean;
  error?: string;
}) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      onError?.("Please upload a JPEG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      onError?.("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempImage(reader.result as string);
      setCropperOpen(true);
      // Clear input so selecting same file triggers change again
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBase64: string) => {
    onChange(croppedBase64);
    setCropperOpen(false);
    setTempImage(null);
  };


  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-sm font-semibold text-heading leading-tight">
            {label}
          </label>
          {required && <span className="text-primary-strong text-sm font-bold">*</span>}
        </div>
      )}
      <div className={`
        relative flex items-center bg-white border rounded-md shadow-sm overflow-hidden transition-all duration-200
        ${error ? "border-red-500" : "border-border/60 hover:border-primary/40 hover:bg-white"}
      `}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        {value ? (
          <div className="flex items-center gap-3 px-3 py-2 flex-1 overflow-hidden">
            <div className="w-8 h-8 rounded border border-border/50 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
              <img src={value} alt="Preview" className="w-full h-full object-contain rounded-sm" />
            </div>
            <span className="text-sm text-heading font-medium truncate">Photo selected</span>
          </div>
        ) : (
          <div className="flex-1 px-4 py-3 text-sm text-muted/70 truncate">
            Choose File
          </div>
        )}
        <div className="px-4 py-3 bg-surface border-l border-border text-sm font-semibold text-muted h-full flex items-center">
          Browse
        </div>
      </div>
      {error && <p className="text-xs font-medium leading-snug text-red-500">{error}</p>}

      {cropperOpen && tempImage && (
        <ImageCropperModal
          image={tempImage}
          onCropComplete={handleCropComplete}
          onClose={() => {
            setCropperOpen(false);
            setTempImage(null);
          }}
        />
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted/20 rounded-md ${className}`}>
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


