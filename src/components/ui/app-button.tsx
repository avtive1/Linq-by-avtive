"use client";

import Link from "next/link";
import { Button as ShadcnButton } from "./button";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
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

/** Linq button padding + type scale; colors follow design-linq.md. */
function getDiscordButtonSizeClasses(
  variant: NonNullable<ButtonProps["variant"]>,
  size: NonNullable<ButtonProps["size"]>,
) {
  if (size === "sm") {
    return "min-h-[44px] py-3 px-6 text-[13px] font-medium";
  }

  if (variant === "secondary") {
    return "min-h-[52px] px-6 py-4 text-[15px] font-medium";
  }

  if (variant === "blue") {
    return "min-h-[48px] py-3 px-6 text-[15px] font-medium";
  }

  return "min-h-[52px] py-4 px-6 text-[15px] font-medium";
}

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
  const mergedClassName = cn(
    "inline-flex h-auto shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border font-medium transition-all duration-150 ease-out focus-visible:ring-2 focus-visible:ring-royal-indigo/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface no-underline motion-token-hover",
    getDiscordButtonSizeClasses(variant, size),
    variant === "primary" &&
      "bg-royal-indigo text-soft-white border-royal-indigo hover:bg-[color-mix(in_oklab,#5A4FCF_85%,black_15%)] active:bg-[color-mix(in_oklab,#5A4FCF_75%,black_25%)] disabled:bg-border disabled:text-text-xmuted disabled:border-border disabled:cursor-not-allowed disabled:active:scale-100",
    variant === "blue" &&
      "bg-royal-indigo text-soft-white border-royal-indigo hover:bg-[color-mix(in_oklab,#5A4FCF_85%,black_15%)] active:bg-[color-mix(in_oklab,#5A4FCF_75%,black_25%)] disabled:bg-border disabled:text-text-xmuted disabled:border-border disabled:cursor-not-allowed",
    variant === "secondary" &&
      "bg-canvas border-border text-text-primary hover:bg-surface disabled:bg-canvas disabled:text-text-xmuted disabled:border-border disabled:cursor-not-allowed",
    fullWidth && "w-full",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} prefetch title={title} className={mergedClassName}>
        <span>{children}</span>
        {icon}
      </Link>
    );
  }

  return (
    <ShadcnButton
      type={type}
      title={title}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      variant="ghost"
      className={mergedClassName}
    >
      <span>{children}</span>
      {icon}
    </ShadcnButton>
  );
}
