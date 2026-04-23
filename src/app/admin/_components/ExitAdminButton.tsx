"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowLeft } from "lucide-react";

export default function ExitAdminButton() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  return (
    <button
      type="button"
      disabled={isExiting}
      onClick={async () => {
        if (isExiting) return;
        setIsExiting(true);
        try {
          await signOut({ redirect: false });
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
      className="group no-link-underline inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/20 hover:text-white disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
      {isExiting ? "Exiting..." : "Exit Admin"}
    </button>
  );
}
