"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import GradientBackground from "@/components/GradientBackground";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Public user signup is disabled; redirect to login
    router.replace("/login");
  }, [router]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-surface">
      <GradientBackground />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center text-center">
        {/* Linq Logo */}
        <div className="mb-6 flex justify-center">
          <Link href="/" className="inline-block transition-opacity hover:opacity-90">
            <Image
              src="/linq-logo.png"
              alt="Linq"
              width={120}
              height={36}
              style={{ width: "auto" }}
              className="h-8 object-contain cursor-pointer"
              priority
            />
          </Link>
        </div>

        <div className="rounded-[16px] border border-border bg-canvas p-8 shadow-sm flex flex-col items-center gap-4 w-full">
          <Loader2 size={32} className="animate-spin text-[#743BE8]" />
          <p className="text-[15px] font-medium text-[#555555]">
            Redirecting to sign in...
          </p>
        </div>
      </div>
    </main>
  );
}
