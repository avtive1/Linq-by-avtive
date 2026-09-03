"use client";

import { useEffect, useState } from "react";

export function useInternalUserId(isAuthenticated = true, isPending = false) {
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Timeout safety fallback: never let isLoading stay true indefinitely
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 4000);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) {
          const resolved = String(payload?.data?.userId || "").trim();
          setUserId(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) setUserId("");
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [isAuthenticated]);

  return { userId, isLoading };
}
