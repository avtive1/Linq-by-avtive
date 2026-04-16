"use client";
import React, { useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { Button } from "./ui";

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onClose: () => void;
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

  // return the canvas as a data url
  return canvas.toDataURL("image/jpeg", 0.9);
};

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  image,
  onCropComplete,
  onClose,
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-[500px] glass-panel !bg-white/95 overflow-hidden animate-in zoom-in-95 duration-500 rounded-3xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-white/50">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-heading leading-tight">Crop Your Photo</h3>
            <p className="text-xs text-muted font-medium mt-0.5">Adjust to fit the card perfectly</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 text-muted transition-colors"
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
            aspect={1}
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
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn size={16} className="text-muted" />
          </div>

          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              fullWidth 
              onClick={onClose}
              disabled={loading}
              className="h-12 text-base rounded-2xl"
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              fullWidth 
              onClick={handleApply}
              disabled={loading}
              className="h-12 text-base rounded-2xl shadow-primary/20 shadow-xl"
              icon={loading ? null : <Check size={18} />}
            >
              {loading ? "Processing..." : "Apply Photo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
