import { isValidImageDataUrl } from "@/lib/utils/image-data-url";

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isValidPixelCrop(crop: PixelCrop | null | undefined): crop is PixelCrop {
  if (!crop) return false;
  return (
    Number.isFinite(crop.x) &&
    Number.isFinite(crop.y) &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    crop.width > 0 &&
    crop.height > 0
  );
}

export function fallbackCenterCrop(
  imageWidth: number,
  imageHeight: number,
  aspect = 1,
): PixelCrop {
  const safeAspect = aspect > 0 ? aspect : 1;
  let cropWidth = imageWidth;
  let cropHeight = cropWidth / safeAspect;
  if (cropHeight > imageHeight) {
    cropHeight = imageHeight;
    cropWidth = cropHeight * safeAspect;
  }
  cropWidth = Math.max(1, Math.min(imageWidth, Math.round(cropWidth)));
  cropHeight = Math.max(1, Math.min(imageHeight, Math.round(cropHeight)));
  return {
    x: Math.max(0, Math.floor((imageWidth - cropWidth) / 2)),
    y: Math.max(0, Math.floor((imageHeight - cropHeight) / 2)),
    width: cropWidth,
    height: cropHeight,
  };
}

export async function getImageDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  const { width, height, cleanup } = await loadCanvasImageSource(src);
  cleanup?.();
  return { width, height };
}

const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
]);

const ACCEPTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

/** Browser/OS MIME labels vary; fall back to file extension when needed. */
export function isAcceptedImageFile(file: File): boolean {
  const type = String(file.type || "").trim().toLowerCase();
  if (type && ACCEPTED_IMAGE_MIME_TYPES.has(type)) return true;
  const name = String(file.name || "").trim();
  return ACCEPTED_IMAGE_EXTENSIONS.test(name);
}

async function loadCanvasImageSource(
  src: string,
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup?: () => void }> {
  const raw = String(src || "").trim();
  if (!raw) throw new Error("Missing image source.");

  // Blob/data URLs via fetch + ImageBitmap avoid canvas taint from HTMLImageElement + crossOrigin.
  if (raw.startsWith("data:") || raw.startsWith("blob:")) {
    const response = await fetch(raw);
    if (!response.ok) throw new Error("Failed to read selected image.");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Failed to load image for cropping.")));
    img.crossOrigin = "anonymous";
    img.src = raw;
  });

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Image has invalid dimensions.");
  return { source: image, width, height };
}

function clampCropToImage(
  crop: PixelCrop,
  imageWidth: number,
  imageHeight: number,
): PixelCrop {
  const x = Math.max(0, Math.min(Math.floor(crop.x), Math.max(0, imageWidth - 1)));
  const y = Math.max(0, Math.min(Math.floor(crop.y), Math.max(0, imageHeight - 1)));
  const width = Math.max(1, Math.min(Math.ceil(crop.width), imageWidth - x));
  const height = Math.max(1, Math.min(Math.ceil(crop.height), imageHeight - y));
  return { x, y, width, height };
}

export async function cropImageAreaToDataUrl(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputType: "image/png" | "image/jpeg" = "image/png",
  quality = 0.92,
  aspect = 1,
): Promise<string> {
  const { source, width, height, cleanup } = await loadCanvasImageSource(imageSrc);
  const crop = isValidPixelCrop(pixelCrop)
    ? clampCropToImage(pixelCrop, width, height)
    : fallbackCenterCrop(width, height, aspect);

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  try {
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const dataUrl =
      outputType === "image/jpeg"
        ? canvas.toDataURL(outputType, quality)
        : canvas.toDataURL(outputType);
    if (!isValidImageDataUrl(dataUrl)) {
      throw new Error("Cropped image could not be encoded.");
    }
    return dataUrl;
  } finally {
    cleanup?.();
  }
}

export async function cropLoadedImageElementToDataUrl(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputType: "image/png" | "image/jpeg" = "image/png",
  quality = 0.92,
): Promise<string> {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Image has invalid dimensions.");

  const crop = clampCropToImage(pixelCrop, width, height);
  const bitmap = await createImageBitmap(image, crop.x, crop.y, crop.width, crop.height);

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No 2d context");
  }

  try {
    ctx.drawImage(bitmap, 0, 0);
    const dataUrl =
      outputType === "image/jpeg"
        ? canvas.toDataURL(outputType, quality)
        : canvas.toDataURL(outputType);
    if (!isValidImageDataUrl(dataUrl)) {
      throw new Error("Cropped image could not be encoded.");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
