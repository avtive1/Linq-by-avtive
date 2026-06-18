import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type EventStatus = {
  label: "Past" | "Today" | "Upcoming";
  classes: string;
};

export function getEventStatus(date: string | null | undefined): EventStatus {
  if (!date) {
    return {
      label: "Upcoming",
      classes: "bg-primary/10 text-ink border-hairline",
    };
  }

  const event = new Date(date);
  if (Number.isNaN(event.getTime())) {
    return {
      label: "Upcoming",
      classes: "bg-primary/10 text-ink border-hairline",
    };
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEvent = new Date(event.getFullYear(), event.getMonth(), event.getDate());
  const diff = startOfEvent.getTime() - startOfToday.getTime();

  if (diff < 0) {
    return {
      label: "Past",
      classes: "bg-surface text-steel border-hairline",
    };
  }
  if (diff === 0) {
    return {
      label: "Today",
      classes: "bg-brand-yellow/20 text-yellow-dark border-brand-yellow/40",
    };
  }
  return {
    label: "Upcoming",
    classes: "bg-primary/10 text-ink border-hairline",
  };
}
