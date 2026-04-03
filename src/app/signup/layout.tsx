import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account | AVTIVE",
  description: "Join AVTIVE today to start your networking journey with smart attendee cards.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
