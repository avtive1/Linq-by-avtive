import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | AVTIVE",
  description: "Manage your events and attendees in one place with AVTIVE's intuitive dashboard.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
