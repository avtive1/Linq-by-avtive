"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExitAdminButton() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isExiting}
      onClick={async () => {
        if (isExiting) return;
        setIsExiting(true);
        try {
          await authClient.signOut();
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
      className="group h-12 gap-2 border border-white/20 bg-white/10 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
      {isExiting ? "Exiting..." : "Exit Admin"}
    </Button>
  );
}
