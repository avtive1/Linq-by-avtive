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

  if (typeof createImageBitmap === "function" && (raw.startsWith("data:") || raw.startsWith("blob:"))) {
    try {
      const response = await fetch(raw);
      if (response.ok) {
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      }
    } catch {
      // Fallback to Image element
    }
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping."));
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

const MAX_OUTPUT_DIMENSION = 1000;

function calculateOutputDimensions(
  width: number,
  height: number,
  maxDim = MAX_OUTPUT_DIMENSION,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const ratio = Math.min(maxDim / width, maxDim / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
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

  const outDim = calculateOutputDimensions(crop.width, crop.height);
  const canvas = document.createElement("canvas");
  canvas.width = outDim.width;
  canvas.height = outDim.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, outDim.width, outDim.height);
    if (outputType === "image/png") {
      removeWhiteBackgroundFromCanvas(canvas);
    }
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

/**
 * Remove solid white / near-white background from an image canvas, making it transparent.
 */
export function removeWhiteBackgroundFromCanvas(
  canvas: HTMLCanvasElement,
  threshold = 215,
  colorTolerance = 40
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = data.length;

  for (let i = 0; i < totalPixels; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    // Check if pixel is light neutral / white / off-white
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const isNeutral =
      Math.abs(r - g) < colorTolerance &&
      Math.abs(r - b) < colorTolerance &&
      Math.abs(g - b) < colorTolerance;

    if (brightness >= threshold && isNeutral) {
      if (brightness >= 240) {
        data[i + 3] = 0;
      } else {
        const factor = (240 - brightness) / (240 - threshold);
        data[i + 3] = Math.round(a * Math.max(0, Math.min(1, factor)));
      }
    }
  }

  // Sample the 4 corners to remove any remaining uniform background
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4, // bottom-right
  ];

  for (const c of corners) {
    const cr = data[c];
    const cg = data[c + 1];
    const cb = data[c + 2];
    const ca = data[c + 3];
    if (ca === 0) continue;

    const cBrightness = (cr * 299 + cg * 587 + cb * 114) / 1000;
    if (cBrightness > 190) {
      for (let i = 0; i < totalPixels; i += 4) {
        const dr = Math.abs(data[i] - cr);
        const dg = Math.abs(data[i + 1] - cg);
        const db = Math.abs(data[i + 2] - cb);
        if (dr < 35 && dg < 35 && db < 35) {
          data[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export async function cropLoadedImageElementToDataUrl(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputType: "image/png" | "image/jpeg" = "image/png",
  quality = 0.92,
  autoRemoveWhiteBg = true,
): Promise<string> {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Image has invalid dimensions.");

  const crop = clampCropToImage(pixelCrop, width, height);
  const outDim = calculateOutputDimensions(crop.width, crop.height);

  const canvas = document.createElement("canvas");
  canvas.width = outDim.width;
  canvas.height = outDim.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outDim.width, outDim.height);

    if (outputType === "image/png" && autoRemoveWhiteBg) {
      removeWhiteBackgroundFromCanvas(canvas);
    }

    const dataUrl =
      outputType === "image/jpeg"
        ? canvas.toDataURL(outputType, quality)
        : canvas.toDataURL(outputType);
    if (!isValidImageDataUrl(dataUrl)) {
      throw new Error("Cropped image could not be encoded.");
    }
    return dataUrl;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Failed to crop image.");
  }
}
