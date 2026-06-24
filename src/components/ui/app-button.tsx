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

/** DESIGN-discord.md button padding + type scale; colors stay DESIGN-miro. */
function getDiscordButtonSizeClasses(
  variant: NonNullable<ButtonProps["variant"]>,
  size: NonNullable<ButtonProps["size"]>,
) {
  if (size === "sm") {
    return "min-h-[44px] py-3 px-8 text-button-sm";
  }

  if (variant === "secondary") {
    return "min-h-[58px] px-6 py-4 text-button-md";
  }

  if (variant === "blue") {
    return "min-h-[48px] py-3 px-6 text-button-lg";
  }

  return "min-h-[58px] py-5 px-6 text-button-lg";
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
    "inline-flex h-auto shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 no-underline",
    getDiscordButtonSizeClasses(variant, size),
    variant === "primary" &&
      "bg-primary text-primary-foreground border border-primary hover:bg-charcoal active:bg-charcoal disabled:bg-hairline disabled:text-muted disabled:border-hairline disabled:cursor-not-allowed disabled:active:scale-100",
    variant === "blue" &&
      "bg-brand-blue text-white border border-brand-blue hover:bg-blue-pressed active:bg-blue-pressed disabled:bg-hairline disabled:text-muted disabled:border-hairline disabled:cursor-not-allowed",
    variant === "secondary" &&
      "bg-transparent border border-hairline-strong text-ink hover:bg-surface disabled:bg-transparent disabled:text-muted disabled:border-hairline disabled:cursor-not-allowed",
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
