"use client";
import React, { useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { Button } from "./ui";

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
  /** Width ÷ height of the crop frame (default 1 = square, e.g. portrait photos). */
  aspect?: number;
  minZoom?: number;
  maxZoom?: number;
  title?: string;
  subtitle?: string;
  applyLabel?: string;
}

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  flip = { horizontal: false, vertical: false }
): Promise<string> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (error) => reject(error));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  // set canvas size to match the pixel crop
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // draw the cropped image onto the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // PNG preserves transparency for logos and PNG uploads; JPEG would show black where alpha was.
  return canvas.toDataURL("image/png");
};

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  image,
  onCropComplete,
  onClose,
  aspect = 1,
  minZoom = 1,
  maxZoom = 3,
  title = "Crop Your Photo",
  subtitle = "Adjust to fit the card perfectly",
  applyLabel = "Apply Photo",
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedImage);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[500px] glass-panel !bg-white/95 overflow-hidden animate-in zoom-in-95 duration-200 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-white/50">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-heading leading-tight">{title}</h3>
            <p className="text-xs text-muted font-medium mt-1">{subtitle}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-[4px] hover:bg-black/5 text-muted transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-[350px] w-full bg-slate-100">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteCallback}
            onZoomChange={onZoomChange}
            objectFit="contain"
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-6 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <ZoomOut size={16} className="text-muted" />
            <input
              type="range"
              value={zoom}
              min={minZoom}
              max={maxZoom}
              step={0.05}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-[4px] appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn size={16} className="text-muted" />
          </div>

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
              disabled={loading}
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
};
