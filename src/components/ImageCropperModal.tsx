"use client";
import React, { useState, useCallback, useId } from "react";
import Cropper, { Area, MediaSize, Point } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { Button } from "./ui";
import { logger } from "@/lib/logger-client";
import { cropImageAreaToDataUrl, isValidPixelCrop } from "@/lib/utils/crop-image";

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
  onError?: (message: string) => void;
  /** Width ÷ height of the crop frame (default 1 = square, e.g. portrait photos). */
  aspect?: number;
  minZoom?: number;
  maxZoom?: number;
  title?: string;
  subtitle?: string;
  applyLabel?: string;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  image,
  onCropComplete,
  onClose,
  onError,
  aspect = 1,
  minZoom = 1,
  maxZoom = 3,
  title = "Crop image",
  subtitle = "Use a square crop for best card branding.",
  applyLabel = "Apply logo",
}) => {
  const rangeId = useId().replace(/:/g, "");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropAreaChange = useCallback((_: Area, pixelCrop: Area) => {
    if (isValidPixelCrop(pixelCrop)) {
      setCroppedAreaPixels(pixelCrop);
    }
  }, []);

  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    if (mediaSize.naturalWidth > 0 && mediaSize.naturalHeight > 0) {
      setMediaLoaded(true);
    }
  }, []);

  const canApply = mediaLoaded;

  const handleApply = async () => {
    if (!mediaLoaded) {
      onError?.("Image is still loading. Please wait a moment.");
      return;
    }
    setLoading(true);
    try {
      const cropArea = isValidPixelCrop(croppedAreaPixels)
        ? croppedAreaPixels
        : { x: 0, y: 0, width: 0, height: 0 };
      const croppedImage = await cropImageAreaToDataUrl(image, cropArea, "image/png", 0.92, aspect);
      onCropComplete(croppedImage);
      onClose();
    } catch (e) {
      const errMessage = e instanceof Error ? e.message : String(e);
      logger.error({ errMessage }, "Image crop failed");
      onError?.("Could not process the image. Please try another photo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-cropper-overlay flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[500px] max-h-[92dvh] glass-panel bg-white/95! overflow-hidden animate-in zoom-in-95 duration-200 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-white/50">
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

        {/* Cropper Container */}
        <div className="relative min-h-0 flex-1 w-full bg-slate-100 max-h-[min(50dvh,400px)]">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onCropChange={onCropChange}
            onCropAreaChange={onCropAreaChange}
            onMediaLoaded={onMediaLoaded}
            onZoomChange={onZoomChange}
            objectFit="contain"
            showGrid
          />
        </div>

        {/* Controls */}
        <div className="shrink-0 px-6 py-6 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <ZoomOut size={16} className="text-muted" />
            <input
              id={`${rangeId}-zoom`}
              name="cropZoom"
              type="range"
              value={zoom}
              min={minZoom}
              max={maxZoom}
              step={0.05}
              aria-label="Crop zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-[4px] appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn size={16} className="text-muted" />
          </div>

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
};
