import { getServerAuthSession } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { PromotionChannelSelect } from "@/components/admin/promotion/PromotionChannelSelect";

export const dynamic = "force-dynamic";

export default async function DashboardPromotionsPage() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen bg-transparent select-text">
      <GradientBackground />

      {/* Top Header Bar */}
      <div className="relative z-50 border-b border-hairline-soft bg-white/85 backdrop-blur-xl shadow-xs">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back to Dashboard</span>
          </Link>

          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/linq-logo.png"
              alt="Linq logo"
              width={90}
              height={30}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-[1240px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <PromotionChannelSelect />
      </div>
    </div>
  );
}
