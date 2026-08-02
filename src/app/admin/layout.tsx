import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import GradientBackground from "@/components/GradientBackground";
import ExitAdminButton from "./_components/ExitAdminButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const sessionEmail = session?.user?.email?.trim().toLowerCase();
  const role = String(session?.user?.role || "");
  const isAdminByRole = typeof role === "string" && role.toLowerCase() === "admin";
  const isAdminByEmail = Boolean(sessionEmail && adminEmails.includes(sessionEmail));
  if (!isAdminByRole && !isAdminByEmail) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />
      
      <div className="relative z-50 border-b border-hairline-soft bg-primary backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex w-full max-w-[1640px] animate-slide-up flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:pb-5 sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] lg:pl-12 lg:pr-12">
          <Link
            href="/admin"
            className="group no-link-underline flex min-w-0 flex-1 items-center gap-3 sm:gap-4 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <div className="shrink-0 overflow-hidden rounded-md border border-white/30 bg-white/95 px-2 py-1 shadow-sm">
              <Image src="/avtive-logo.svg" alt="Avtive logo" width={138} height={32} className="h-8 w-auto max-w-[min(138px,calc(100vw-11rem))]" priority />
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className="text-xl font-semibold leading-tight tracking-[0.02em]" style={{ color: "#FFFFFF" }}>
                Owner Console
              </h1>
              <p className="text-sm font-medium leading-snug tracking-[0.02em] text-white/75">
                Avtive Global Super Admin
              </p>
            </div>
          </Link>

          <div className="flex w-full shrink-0 justify-end sm:w-auto animate-slide-up">
            <ExitAdminButton />
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[1640px] mx-auto">
        {children}
      </div>
    </div>
  );
}
