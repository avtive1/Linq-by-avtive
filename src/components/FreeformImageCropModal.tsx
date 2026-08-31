"use client";

import React, { useCallback, useRef, useState } from "react";
import ReactCrop, { type PixelCrop as ReactImagePixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check } from "lucide-react";
import { logger } from "@/lib/logger-client";
import { Button } from "./ui";
import { cropLoadedImageElementToDataUrl, type PixelCrop } from "@/lib/utils/crop-image";

function toNaturalPixelCrop(image: HTMLImageElement, pixelCrop: ReactImagePixelCrop): PixelCrop {
  const scaleX = (image.naturalWidth || image.width) / image.width;
  const scaleY = (image.naturalHeight || image.height) / image.height;
  return {
    x: pixelCrop.x * scaleX,
    y: pixelCrop.y * scaleY,
    width: pixelCrop.width * scaleX,
    height: pixelCrop.height * scaleY,
  };
}

function getCroppedImageDataUrl(image: HTMLImageElement, pixelCrop: ReactImagePixelCrop): Promise<string> {
  return cropLoadedImageElementToDataUrl(image, toNaturalPixelCrop(image, pixelCrop), "image/png");
}

export type FreeformImageCropModalProps = {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
  onError?: (message: string) => void;
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
  onError,
  title = "Crop image",
  subtitle = "Drag the corners or edges to choose any size.",
  applyLabel = "Apply",
}: FreeformImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<ReactImagePixelCrop>();
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
      const dataUrl = await getCroppedImageDataUrl(el, crop);
      onCropComplete(dataUrl);
      onClose();
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      logger.error({ errMessage }, "Freeform image crop failed");
      onError?.("Could not process the image. Please try another photo.");
    } finally {
      setLoading(false);
    }
  };

  const canApply = Boolean(crop && crop.width >= 2 && crop.height >= 2);

  return (
    <div className="fixed inset-0 z-cropper-overlay flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onClose}
              disabled={loading}
              className="order-2 rounded-md sm:order-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={handleApply}
              disabled={loading || !canApply}
              className="order-1 rounded-md shadow-black/10 shadow-xl sm:order-2"
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
