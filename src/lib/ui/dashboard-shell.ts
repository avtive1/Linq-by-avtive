/**
 * Shared layout classes for organization dashboard (/dashboard) and campaign pages (/dashboard/events/[id]).
 * Safe-area insets honor root layout viewport-fit (see app/layout.tsx).
 */

/** Primary content column: centered max-width + horizontal/vertical inset + notch padding */
export const dashboardContentInset =
  "relative z-10 mx-auto min-w-0 w-full max-w-[1480px] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] lg:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:pt-[max(4rem,env(safe-area-inset-top))] sm:pb-[max(4rem,env(safe-area-inset-bottom))] md:pt-[max(5rem,env(safe-area-inset-top))] md:pb-[max(5rem,env(safe-area-inset-bottom))]";

/** Default dashboard <main> shell */
export const dashboardMainTransparent =
  "relative min-h-dvh w-full overflow-x-hidden bg-transparent";

/** Centered error / empty campaign shell */
export const dashboardMainWhiteCenter =
  "relative flex min-h-dvh w-full flex-col items-center justify-center gap-4 overflow-x-hidden bg-white pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]";

export const dashboardPreviewBannerOuter =
  "relative z-100 border-b border-white/20 bg-linear-to-r from-heading via-[#2B4F95] to-heading pb-3 shadow-sm pt-[max(0.75rem,env(safe-area-inset-top))]";

export const dashboardPreviewBannerInner =
  "mx-auto flex w-full max-w-[1480px] min-w-0 flex-col gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-sm font-medium text-white sm:flex-row sm:items-center sm:justify-between";

/** Centered modal dialogs (scrolls when taller than viewport) */
export const dashboardModalBackdrop =
  "fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:p-8";

/** Tall / top-aligned dialogs (registration builder, etc.) */
export const dashboardModalBackdropTop =
  "fixed inset-0 z-100 flex items-start justify-center overflow-y-auto p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:p-8";
