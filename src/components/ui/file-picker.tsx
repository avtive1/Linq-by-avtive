"use client";

import { useState, useId } from "react";
import { ImageCropperModal } from "../ImageCropperModal";
import { FreeformImageCropModal } from "../FreeformImageCropModal";
import { Label } from "./label";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function FilePicker({
  label,
  id,
  name,
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
  id?: string;
  name?: string;
  value?: string;
  onChange: (base64: string) => void;
  onError?: (message: string) => void;
  required?: boolean;
  error?: string;
  freeFormCrop?: boolean;
  cropAspect?: number;
  cropMinZoom?: number;
  cropMaxZoom?: number;
  cropTitle?: string;
  cropSubtitle?: string;
  cropApplyLabel?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const inputId = id ?? name ?? `file-${uid}`;
  const inputName = name ?? inputId;
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
    <div className="flex w-full flex-col gap-2">
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </Label>
          {required && <span className="text-sm font-medium text-ink">*</span>}
        </div>
      )}
      <div
        className={cn(
          "relative flex h-11 items-center overflow-hidden rounded-md border bg-white shadow-sm transition-all duration-200",
          error ? "border-destructive" : "border-hairline-strong hover:border-brand-blue/40"
        )}
      >
        <input id={inputId} name={inputName} type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 z-10 cursor-pointer opacity-0" />
        {value ? (
          <div className="flex flex-1 items-center gap-3 overflow-hidden px-4 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline p-1">
              <img src={value} alt="Preview" className="h-full w-full rounded-sm object-contain" loading="lazy" decoding="async" />
            </div>
            <span className="truncate text-base font-medium text-ink">Photo selected</span>
          </div>
        ) : (
          <div className="flex-1 truncate px-4 py-2 text-base font-medium text-steel">Choose File</div>
        )}
        <div className="flex h-full items-center border-l border-hairline bg-surface px-4 text-sm font-medium text-steel">Browse</div>
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

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
