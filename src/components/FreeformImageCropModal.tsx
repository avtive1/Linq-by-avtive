"use client";

import React, { useCallback, useRef, useState } from "react";
import ReactCrop, { type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check } from "lucide-react";
import { Button } from "./ui";

function getCroppedImageDataUrl(image: HTMLImageElement, pixelCrop: PixelCrop): string {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = pixelCrop.x * scaleX;
  const sy = pixelCrop.y * scaleY;
  const sWidth = pixelCrop.width * scaleX;
  const sHeight = pixelCrop.height * scaleY;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sWidth));
  canvas.height = Math.max(1, Math.round(sHeight));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  // PNG keeps alpha; JPEG would flatten transparency to black on the card.
  return canvas.toDataURL("image/png");
}

export type FreeformImageCropModalProps = {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  applyLabel?: string;
};

/** Max displayed image size so the full bitmap fits in the dialog without scrolling. */
const CROP_STAGE_MAX_STYLE: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "min(68dvh, calc(100dvh - 14rem))",
};

export function FreeformImageCropModal({
  image,
  onCropComplete,
  onClose,
  title = "Crop image",
  subtitle = "Drag the corners or edges to choose any size.",
  applyLabel = "Apply",
}: FreeformImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<PixelCrop>();
  const [loading, setLoading] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop({
      unit: "px",
      x: Math.round(width * 0.05),
      y: Math.round(height * 0.05),
      width: Math.round(width * 0.9),
      height: Math.round(height * 0.9),
    });
  }, []);

  const handleApply = async () => {
    const el = imgRef.current;
    if (!el || !crop || crop.width < 2 || crop.height < 2) return;
    setLoading(true);
    try {
      const dataUrl = getCroppedImageDataUrl(el, crop);
      onCropComplete(dataUrl);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const canApply = Boolean(crop && crop.width >= 2 && crop.height >= 2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[min(92dvh,900px)] w-full max-w-[min(560px,calc(100%-1.5rem))] flex-col overflow-hidden glass-panel !bg-white/95 animate-in zoom-in-95 duration-200 rounded-lg shadow-2xl">
        <div className="shrink-0 px-5 py-4 sm:px-6 sm:py-5 border-b border-border/50 flex items-center justify-between bg-white/50">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-heading leading-tight">{title}</h3>
            <p className="text-xs text-muted font-medium mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[4px] hover:bg-black/5 text-muted transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cap size on the crop root so child-wrapper + img inherit — full bitmap visible, no scroll */}
        <div className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden bg-slate-100 p-2 sm:p-3">
          <ReactCrop
            crop={crop}
            onChange={(next) => setCrop(next)}
            className="max-w-full"
            style={CROP_STAGE_MAX_STYLE}
            ruleOfThirds
            minWidth={16}
            minHeight={16}
            keepSelection
          >
            <img
              ref={imgRef}
              src={image}
              alt="Crop preview"
              className="block h-auto w-auto max-w-full object-contain"
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        <div className="shrink-0 px-5 py-5 sm:px-6 flex flex-col gap-6">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={onClose}
              disabled={loading}
              className="h-12 text-base rounded-md"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleApply}
              disabled={loading || !canApply}
              className="h-12 text-base rounded-md shadow-primary/20 shadow-xl"
              icon={loading ? null : <Check size={18} />}
            >
              {loading ? "Processing..." : applyLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
