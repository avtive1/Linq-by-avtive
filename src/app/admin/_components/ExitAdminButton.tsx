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
      className="group no-link-underline inline-flex h-12 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
      {isExiting ? "Exiting..." : "Exit Admin"}
    </button>
  );
}
