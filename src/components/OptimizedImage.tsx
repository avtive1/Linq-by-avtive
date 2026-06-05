"use client";

import Image from "next/image";
import { optimizeCdnImageUrl } from "@/lib/utils/cdn-image";

type OptimizedImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  loading?: "lazy" | "eager";
  sizes?: string;
};

function isOptimizableRemote(src: string) {
  return src.startsWith("https://res.cloudinary.com/") || src.startsWith("/");
}

/**
 * Next/Image wrapper with Cloudinary CDN transforms. Falls back to native img for unknown hosts.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  loading,
  sizes,
}: OptimizedImageProps) {
  const optimizedSrc = optimizeCdnImageUrl(src, { width, quality: "auto" });

  if (!isOptimizableRemote(optimizedSrc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={priority ? "eager" : loading || "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      loading={priority ? undefined : loading || "lazy"}
      sizes={sizes}
    />
  );
}
