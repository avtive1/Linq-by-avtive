"use client";

import { useCallback, useEffect, useState } from "react";
import { useReducedMotion, type Variants } from "framer-motion";

const EASE_STANDARD: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const DASHBOARD_REFRESH_INTERVAL_MS = 30000;
export const DASHBOARD_VIEWPORT_DEFAULTS = { once: true, amount: 0.16 } as const;
export const DASHBOARD_MOTION_DURATIONS = {
  fast: 0.22,
  standard: 0.32,
  slow: 0.44,
} as const;

export function useDashboardMotion() {
  const reduceMotion = useReducedMotion();

  const presets = {
    durations: DASHBOARD_MOTION_DURATIONS,
    ease: EASE_STANDARD,
    viewport: DASHBOARD_VIEWPORT_DEFAULTS,
  } as const;

  const fadeUp = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: presets.durations.standard, ease: presets.ease, delay },
        };

  const staggerItem = (index: number, step = 0.04, maxDelay = 0.28, y = 14, duration = 0.3) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration,
            ease: presets.ease,
            delay: Math.min(index * step, maxDelay),
          },
        };

  const hoverLift = (y = -4, scale = 1.01) =>
    reduceMotion
      ? {}
      : {
          whileHover: { y, scale },
          whileTap: { scale: 0.995 },
          transition: { duration: presets.durations.fast, ease: presets.ease },
        };

  const hoverIconNudge = (x = 2) =>
    reduceMotion
      ? {}
      : {
          whileHover: { x },
          transition: { duration: presets.durations.fast, ease: presets.ease },
        };

  const sectionVariants: Variants = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: presets.durations.standard, ease: presets.ease },
        },
      };

  return {
    reduceMotion,
    presets,
    fadeUp,
    staggerItem,
    hoverLift,
    hoverIconNudge,
    sectionVariants,
  };
}

export function useAutoRefresh(enabled: boolean, intervalMs = DASHBOARD_REFRESH_INTERVAL_MS) {
  const [refreshTick, setRefreshTick] = useState(0);
  const triggerRefresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(triggerRefresh, intervalMs);
    const onFocus = () => triggerRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") triggerRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, triggerRefresh]);

  return { refreshTick, triggerRefresh };
}
