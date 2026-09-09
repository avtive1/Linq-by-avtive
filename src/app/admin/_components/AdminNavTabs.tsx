"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavTabsProps {
  pendingRequestsCount?: number;
}

export function AdminNavTabs({ pendingRequestsCount }: AdminNavTabsProps) {
  const pathname = usePathname();

  const isDirectory = pathname === "/admin" || pathname.startsWith("/admin/organizations/");
  const isRequests = pathname.startsWith("/admin/organization-requests");
  const isNewOrg = pathname === "/admin/organizations/new";

  const navItems = [
    {
      href: "/admin",
      label: "Directory & Overview",
      icon: Building2,
      active: pathname === "/admin" || (isDirectory && !isNewOrg),
    },
    {
      href: "/admin/organization-requests",
      label: "Organization Requests",
      icon: ClipboardList,
      active: isRequests,
      badge: pendingRequestsCount && pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    {
      href: "/admin/organizations/new",
      label: "New Organization",
      icon: PlusCircle,
      active: isNewOrg,
    },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all whitespace-nowrap",
              item.active
                ? "bg-white text-primary shadow-xs font-bold"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon size={14} />
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
