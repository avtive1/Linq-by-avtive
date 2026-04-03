import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | AVTIVE",
  description: "Sign in to your AVTIVE account to manage your attendee cards and events.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
