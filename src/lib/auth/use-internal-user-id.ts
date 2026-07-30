"use client";

import { useEffect, useState } from "react";

export function useInternalUserId(isAuthenticated: boolean, isPending = false) {
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(() => isPending || isAuthenticated);

  useEffect(() => {
    let cancelled = false;
    if (isPending) return;
    if (!isAuthenticated) {
      queueMicrotask(() => {
        if (!cancelled) {
          setUserId("");
          setIsLoading(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) setUserId(String(payload?.data?.userId || ""));
      })
      .catch(() => {
        if (!cancelled) setUserId("");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPending]);

  return { userId, isLoading };
}
