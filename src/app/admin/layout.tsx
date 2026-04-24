import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import ExitAdminButton from "./_components/ExitAdminButton";

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
      
      <div className="relative z-50 border-b border-white/15 bg-linear-to-r from-heading via-[#2B4F95] to-heading backdrop-blur-xl shadow-2xl">
        <div className="mx-auto flex w-full max-w-[1640px] animate-slide-up items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-12">
          <Link
            href="/admin"
            className="group no-link-underline flex items-center gap-4 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <div className="overflow-hidden rounded-md border border-white/30 bg-white/95 px-2 py-1 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
              <Image src="/avtive-logo.svg" alt="Avtive logo" width={138} height={32} priority />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold leading-tight tracking-[0.02em]" style={{ color: "#FFFFFF" }}>
                Owner Console
              </h1>
              <p className="text-sm font-medium leading-snug tracking-[0.02em] text-white/75">
                Avtive Global Super Admin
              </p>
            </div>
          </Link>



          <div className="flex items-center gap-3 animate-slide-up">
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
