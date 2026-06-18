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
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-11 px-6 text-sm min-h-[44px]",
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
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-normal transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 no-underline",
    sizeClasses[size],
    variant === "primary" &&
      "bg-primary text-primary-foreground border border-primary hover:bg-charcoal",
    variant === "blue" &&
      "bg-brand-blue text-white border border-brand-blue hover:brightness-95",
    variant === "secondary" &&
      "bg-transparent border border-hairline-strong text-ink hover:bg-surface",
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
