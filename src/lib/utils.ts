/**
 * Returns a status descriptor for an event date string.
 * Compares the date portion only — ignores time-of-day so events on
 * "today" never appear as past during the day.
 */
export type EventStatus = {
  label: "Past" | "Today" | "Upcoming";
  classes: string;
};

export function getEventStatus(date: string | null | undefined): EventStatus {
  if (!date) {
    return {
      label: "Upcoming",
      classes: "bg-primary/10 text-primary-strong border-primary/20",
    };
  }

  const event = new Date(date);
  if (Number.isNaN(event.getTime())) {
    return {
      label: "Upcoming",
      classes: "bg-primary/10 text-primary-strong border-primary/20",
    };
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEvent = new Date(event.getFullYear(), event.getMonth(), event.getDate());

  const diff = startOfEvent.getTime() - startOfToday.getTime();

  if (diff < 0) {
    return {
      label: "Past",
      classes: "bg-muted/10 text-muted border-muted/20",
    };
  }
  if (diff === 0) {
    return {
      label: "Today",
      classes: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
  }
  return {
    label: "Upcoming",
    classes: "bg-primary/10 text-primary-strong border-primary/20",
  };
}
