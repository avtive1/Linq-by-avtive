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

const sizeClasses = {
  sm: "h-10 px-4 text-button-md",
  md: "h-11 px-6 text-button-md",
  lg: "h-11 min-h-[44px] px-6 text-button-md",
};

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
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 no-underline",
    sizeClasses[size],
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
