"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, User, Clock3 } from "lucide-react";
import { ImageCropperModal } from "./ImageCropperModal";
import { FreeformImageCropModal } from "./FreeformImageCropModal";


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
  maxLength?: number;
  disabled?: boolean;
  min?: string;
};

type TimeInputProps = {
  label?: string;
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

export function TextArea({
  label,
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
}: InputProps & { rows?: number }) {
  const isLocked = Boolean(disabled || readOnly);
  const borderClasses = error
    ? "border-red-500 focus-within:border-red-500"
    : isLocked
      ? "border-slate-200 focus-within:border-slate-300 focus-within:border-[1.5px]"
      : "border-border/60 focus-within:border-primary/80 focus-within:border-[1.5px]";

  return (
    <div className={`flex flex-col gap-2 w-full group ${className}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label
            className={`text-[14px] font-medium leading-[1.25] tracking-[0.01em] ${isLocked ? "text-muted" : "text-heading"}`}
          >
            {label}
          </label>
          {required && <span className="text-primary-strong text-[14px] font-semibold leading-[1.25]">*</span>}
        </div>
      )}
      <div 
        className={`
          flex border rounded-md shadow-sm transition-all duration-200 overflow-hidden
          ${borderClasses}
          ${isLocked ? "bg-slate-100 cursor-not-allowed" : "bg-white"}
        `}
      >
        <textarea
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          maxLength={maxLength}
          className={`w-full p-4 text-[16px] leading-[1.6] border-none outline-none focus:ring-0 placeholder:text-muted/40 placeholder:font-normal font-normal resize-none ${
            isLocked ? "text-slate-500 cursor-not-allowed bg-transparent" : "text-heading bg-transparent"
          }`}
        />
      </div>
      {maxLength && (
        <p className={`text-[12px] font-medium text-right mt-1 ${String(value || "").length >= maxLength ? "text-amber-600" : "text-muted"}`}>
          {String(value || "").length}/{maxLength}
        </p>
      )}
      {error && <p className="text-[14px] font-medium leading-[1.55] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

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
  maxLength,
  disabled,
  min,
}: InputProps) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPass ? "text" : "password") : type;
  const isLocked = Boolean(disabled || readOnly);
  const borderClasses = error
    ? "border-red-500 focus-within:border-red-500"
    : isLocked
      ? "border-slate-200 focus-within:border-slate-300 focus-within:border-[1.5px]"
      : "border-border/60 focus-within:border-primary/80 focus-within:border-[1.5px]";

  return (
    <div className={`flex flex-col gap-2 w-full group ${className}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label
            className={`text-[14px] font-medium leading-[1.25] tracking-[0.01em] ${isLocked ? "text-muted" : "text-heading"}`}
          >
            {label}
          </label>
          {required && <span className="text-primary-strong text-[14px] font-semibold leading-[1.25]">*</span>}
        </div>
      )}
      <div 
        className={`
          flex h-11 items-center border rounded-md shadow-sm transition-all duration-200 overflow-hidden
          ${borderClasses}
          ${isLocked ? "bg-slate-100 cursor-not-allowed" : "bg-white"}
        `}
      >
        {prefix && (
          <div className="flex items-center h-full">
            <span className="px-4 text-[15px] leading-[1.25] tracking-[0.01em] text-muted bg-surface/50 whitespace-nowrap h-full flex items-center font-medium">
              {prefix}
            </span>
          </div>
        )}
        {icon && (
          <div className="pl-5 shrink-0 text-muted">
            {icon === "email" && <Mail size={18} />}
            {icon === "lock" && <Lock size={18} />}
            {icon === "user" && <User size={18} />}
          </div>
        )}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          autoComplete={autoComplete}
          name={name}
          readOnly={readOnly}
          disabled={disabled}
          onFocus={onFocus}
          maxLength={maxLength}
          min={min}
          className={`h-full flex-1 py-0 text-[16px] leading-[1.6] border-none outline-none focus:ring-0 placeholder:text-muted/40 placeholder:font-normal font-normal ${
            isLocked ? "text-slate-500 cursor-not-allowed bg-transparent" : "text-heading bg-transparent"
          } ${
            icon || prefix ? "px-4" : "px-4"
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="p-2 text-muted hover:text-heading transition-colors duration-150 rounded-inline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-[14px] font-medium leading-[1.55] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function TimeInput({
  label,
  required,
  value = "",
  onChange,
  error,
  disabled,
}: TimeInputProps) {
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

  const listBase =
    "h-56 overflow-y-auto px-1 py-1 border border-border/10 rounded-md bg-slate-50/50 custom-scrollbar w-full";
  const itemBase =
    "w-full rounded-md px-2 py-1.5 text-center text-[15px] font-medium tracking-[0.01em] leading-tight transition-all duration-200";
  const selectedItem = "bg-primary/20 text-primary-strong shadow-sm scale-[1.02] font-semibold border border-primary/20";
  const idleItem = "text-heading hover:bg-primary/10 hover:text-primary-strong";
  const displayValue = `${parsed.hour12}:${parsed.minute} ${parsed.period}`;
  const borderClasses = error
    ? "border-red-500 focus-within:border-red-500"
    : "border-border/60 focus-within:border-primary/80 focus-within:border-[1.5px]";

  return (
    <div ref={wrapRef} className={`relative flex flex-col gap-2 w-full group ${disabled ? "opacity-60" : ""}`}>
      {label && (
        <div className="flex items-center gap-1">
          <label className="text-[14px] font-medium text-heading leading-[1.25] tracking-[0.01em]">{label}</label>
          {required && <span className="text-primary-strong text-[14px] font-medium leading-[1.25]">*</span>}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          flex h-11 w-full items-center rounded-md border bg-white px-4 text-left shadow-sm transition-all duration-200
          ${borderClasses}
          ${disabled ? "cursor-not-allowed bg-surface/50" : "cursor-pointer hover:border-primary/40"}
        `}
      >
        <span className={`flex-1 text-[16px] leading-[1.6] ${value ? "text-heading" : "text-muted/55"}`}>
          {value ? displayValue : "--:-- --"}
        </span>
        <Clock3 size={18} className="text-muted/60 group-hover:text-primary transition-colors" />
      </button>
      {isOpen && !disabled && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[120] w-[280px] rounded-lg border border-border/60 bg-white p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Caret / Arrow */}
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-t border-l border-border/60 rotate-45" />
          <div className="flex items-start gap-2.5 h-full relative z-10">
            <div className="flex flex-col flex-1 gap-1.5">
              <span className="text-[10px] font-bold text-muted/60 uppercase tracking-wider text-center mb-1">Hour</span>
              <div className={listBase}>
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => commit(h, parsed.minute, parsed.period)}
                    className={`${itemBase} ${parsed.hour12 === h ? selectedItem : idleItem} mb-0.5 last:mb-0`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col flex-1 gap-1.5">
              <span className="text-[10px] font-bold text-muted/60 uppercase tracking-wider text-center mb-1">Min</span>
              <div className={listBase}>
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => commit(parsed.hour12, m, parsed.period)}
                    className={`${itemBase} ${parsed.minute === m ? selectedItem : idleItem} mb-0.5 last:mb-0`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col flex-1 gap-1.5">
              <span className="text-[10px] font-bold text-muted/60 uppercase tracking-wider text-center mb-1">AM/PM</span>
              <div className={listBase}>
                {periods.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => commit(parsed.hour12, parsed.minute, p)}
                    className={`${itemBase} ${parsed.period === p ? selectedItem : idleItem} mb-0.5 last:mb-0`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-[14px] font-medium leading-[1.55] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  /** When set, renders as `<Link>` (valid markup). Do not nest `Button` inside `Link`. */
  href?: string;
  variant?: "primary" | "secondary" | "blue";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  type?: "button" | "submit";
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
};

export function Button({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  type = "button",
  icon,
  className = "",
  disabled,
  title,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isBlue = variant === "blue";
  
  const sizeClasses = {
    sm: "h-10 px-4 text-[15px] leading-[1.25] rounded-md font-semibold",
    md: "h-11 px-5 text-[17px] leading-[1.25] rounded-md font-semibold",
    lg: "h-12 px-6 text-[18px] leading-[1.25] rounded-md font-semibold",
  };

  const mergedClassName = `
        inline-flex items-center justify-center gap-2 tracking-[0em] transition-[background-color,opacity,transform,box-shadow] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2
        ${sizeClasses[size]}
        ${isPrimary 
          ? "bg-primary text-primary-foreground border border-primary shadow-lg shadow-primary/25 hover:brightness-95 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-70 disabled:saturate-75 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100" 
          : isBlue
          ? "bg-heading text-white border border-heading shadow-lg shadow-heading/25 hover:brightness-110 hover:shadow-xl hover:shadow-heading/30 disabled:opacity-70 disabled:saturate-80 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"
          : "bg-white border border-border text-heading hover:text-primary-strong hover:border-primary/60 hover:bg-primary/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100"}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `.trim();

  if (href && !disabled) {
    return (
      <Link href={href} prefetch title={title} className={`no-underline ${mergedClassName}`}>
        <span>{children}</span>
        {icon}
      </Link>
    );
  }

  return (
    <button
      type={type}
      title={title}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={mergedClassName}
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
          <label className="text-[14px] font-medium text-heading leading-[1.25] tracking-[0.01em]">
            {label}
          </label>
          {required && <span className="text-primary-strong text-[14px] font-medium leading-[1.25]">*</span>}
        </div>
      )}
      <div 
        className={`
          flex h-11 items-center bg-white border rounded-md shadow-sm transition-all duration-200 overflow-hidden
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
            h-full flex-1 px-4 py-0 text-[16px] leading-[1.6] bg-transparent border-none outline-none focus:ring-0 appearance-none
            ${value ? "text-heading font-normal" : "text-muted/40 font-normal"}
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
      {error && <p className="text-[14px] font-medium leading-[1.55] text-red-500 mt-1">{error}</p>}
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
  cropAspect,
  cropMinZoom,
  cropMaxZoom,
  cropTitle,
  cropSubtitle,
  cropApplyLabel,
  freeFormCrop,
}: {
  label?: string;
  value?: string;
  onChange: (base64: string) => void;
  onError?: (message: string) => void;
  required?: boolean;
  error?: string;
  /** When false, uses fixed-aspect pan/zoom cropper. Default true (corner handles, any aspect). */
  freeFormCrop?: boolean;
  /** Passed to the fixed-aspect cropper (width ÷ height). Default 1 (square). */
  cropAspect?: number;
  cropMinZoom?: number;
  cropMaxZoom?: number;
  cropTitle?: string;
  cropSubtitle?: string;
  cropApplyLabel?: string;
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
          <label className="text-[14px] font-medium text-heading leading-[1.25] tracking-[0.01em]">
            {label}
          </label>
          {required && <span className="text-primary-strong text-[14px] font-medium leading-[1.25]">*</span>}
        </div>
      )}
      <div className={`
        relative flex h-11 items-center bg-white border rounded-md shadow-sm overflow-hidden transition-all duration-200
        ${error ? "border-red-500" : "border-border/60 hover:border-primary/40 hover:bg-white"}
      `}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        {value ? (
          <div className="flex items-center gap-3 px-4 py-2 flex-1 overflow-hidden">
            <div className="w-8 h-8 rounded-md border border-border/50 overflow-hidden shrink-0 flex items-center justify-center p-1">
              <img src={value} alt="Preview" className="w-full h-full object-contain rounded-sm" />
            </div>
            <span className="text-[16px] leading-[1.6] text-heading font-medium truncate">Photo selected</span>
          </div>
        ) : (
          <div className="flex-1 px-4 py-2 text-[16px] leading-[1.6] text-muted/55 truncate font-medium">
            Choose File
          </div>
        )}
        <div className="px-4 py-2 bg-surface border-l border-border text-[14px] leading-[1.25] font-medium tracking-[0.01em] text-muted h-full flex items-center">
          Browse
        </div>
      </div>
      {error && <p className="text-[14px] font-medium leading-[1.55] text-red-500">{error}</p>}

      {cropperOpen && tempImage && (
        freeFormCrop !== false ? (
          <FreeformImageCropModal
            image={tempImage}
            onCropComplete={handleCropComplete}
            onClose={() => {
              setCropperOpen(false);
              setTempImage(null);
            }}
            title={cropTitle ?? "Crop image"}
            subtitle={cropSubtitle ?? "Drag the corners or edges to adjust the crop."}
            applyLabel={cropApplyLabel ?? "Apply"}
          />
        ) : (
          <ImageCropperModal
            image={tempImage}
            onCropComplete={handleCropComplete}
            onClose={() => {
              setCropperOpen(false);
              setTempImage(null);
            }}
            aspect={cropAspect ?? 1}
            minZoom={cropMinZoom ?? 1}
            maxZoom={cropMaxZoom ?? 3}
            title={cropTitle ?? "Crop image"}
            subtitle={cropSubtitle ?? "Use a square crop for best card branding."}
            applyLabel={cropApplyLabel ?? "Apply logo"}
          />
        )
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
      countRef.current = endValue;
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


