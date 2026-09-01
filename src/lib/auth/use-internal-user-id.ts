"use client";

import { useEffect, useState } from "react";

export function useInternalUserId(isAuthenticated = true, isPending = false) {
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (isPending) return;

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
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPending]);

  return { userId, isLoading };
}
