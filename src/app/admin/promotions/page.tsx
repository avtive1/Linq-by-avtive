import { getServerAuthSession } from "@/auth";
import { redirect } from "next/navigation";
import PromotionsHub from "@/components/promotions/PromotionsHub";

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
  if (!isAdminByRole && !isAdminByEmail) {
    redirect("/dashboard");
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1640px] mx-auto">
      <PromotionsHub
        organizationName="Linq Global Command"
        userEmail={session?.user?.email || ""}
      />
    </div>
  );
}
