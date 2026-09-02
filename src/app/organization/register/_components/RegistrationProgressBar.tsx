"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepNumber = 1 | 2 | 3 | 4;

interface StepItem {
  number: StepNumber;
  title: string;
  shortTitle: string;
}

const STEPS: StepItem[] = [
  { number: 1, title: "Contact Person", shortTitle: "Contact" },
  { number: 2, title: "Organization Info", shortTitle: "Organization" },
  { number: 3, title: "Details & Location", shortTitle: "Details" },
  { number: 4, title: "Review & Submit", shortTitle: "Review" },
];

interface RegistrationProgressBarProps {
  currentStep: StepNumber;
  onStepClick?: (step: StepNumber) => void;
  maxAccessibleStep?: StepNumber;
}

export function RegistrationProgressBar({
  currentStep,
  onStepClick,
  maxAccessibleStep = 4,
}: RegistrationProgressBarProps) {
  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        {STEPS.map((step, idx) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isClickable = onStepClick && step.number <= maxAccessibleStep;

          return (
            <div key={step.number} className="flex flex-1 items-center last:flex-none">
              <div
                onClick={() => {
                  if (isClickable) onStepClick(step.number);
                }}
                className={cn(
                  "group flex flex-col items-center gap-1.5 transition-all",
                  isClickable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                    isCompleted && "bg-primary text-primary-foreground shadow-sm",
                    isCurrent && "border-2 border-primary bg-primary/10 text-primary font-bold ring-4 ring-primary/10",
                    !isCompleted && !isCurrent && "border border-hairline-strong bg-white text-muted",
                  )}
                >
                  {isCompleted ? <Check size={16} strokeWidth={2.5} /> : step.number}
                </div>
                <span
                  className={cn(
                    "hidden text-xs font-medium tracking-tight sm:inline-block transition-colors",
                    isCurrent && "text-heading font-semibold",
                    isCompleted && "text-ink font-medium",
                    !isCompleted && !isCurrent && "text-muted",
                  )}
                >
                  {step.title}
                </span>
                <span
                  className={cn(
                    "inline-block text-[11px] font-medium sm:hidden",
                    isCurrent && "text-heading font-semibold",
                    !isCurrent && "text-muted",
                  )}
                >
                  {step.shortTitle}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 sm:mx-4 h-0.5 flex-1 transition-colors duration-200",
                    step.number < currentStep ? "bg-primary" : "bg-hairline-strong",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
