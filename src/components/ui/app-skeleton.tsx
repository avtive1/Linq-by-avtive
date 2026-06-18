import { Skeleton as ShadcnSkeleton } from "./skeleton";
import { cn } from "@/lib/utils";

export function Skeleton({ className = "" }: { className?: string }) {
  return <ShadcnSkeleton className={cn("rounded-md bg-hairline-soft", className)} />;
}
