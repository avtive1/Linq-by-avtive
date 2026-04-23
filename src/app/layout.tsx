import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter-tight",
});


export const metadata: Metadata = {
  title: "Avtive — Your Conference Card",
  description: "Register once. Generate a card for every event you attend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.variable}>
      <body className={interTight.className}>
        <AuthSessionProvider>
          <Toaster position="top-center" richColors />
          {children}
          <Analytics />
          <SpeedInsights />
        </AuthSessionProvider>
      </body>
    </html>
  );
}