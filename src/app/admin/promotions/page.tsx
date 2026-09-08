import { getServerAuthSession } from "@/auth";
import { redirect } from "next/navigation";
import { queryNeon } from "@/lib/neon-db";
import { PromotionChannelSelect } from "@/components/admin/promotion/PromotionChannelSelect";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
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

  let isOrgAdmin = false;
  if (userId) {
    try {
      const eventRow = await queryNeon<{ count: string | number }>(
        `SELECT COUNT(*)::int AS count FROM public.events WHERE user_id = $1`,
        [userId],
      );
      if (Number(eventRow[0]?.count || 0) > 0) {
        isOrgAdmin = true;
      }
    } catch {
      // Fallback
    }
  }

  if (!isAdminByRole && !isAdminByEmail && !isOrgAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1240px] mx-auto">
      <PromotionChannelSelect />
    </div>
  );
}
