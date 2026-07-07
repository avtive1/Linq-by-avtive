import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Avtive — Your Conference Card",
  description: "Register once. Generate a card for every event you attend.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} font-sans`}>
      <body className={dmSans.className}>
        <ClerkProvider>
          <AuthSessionProvider>
            <Toaster position="top-center" richColors />
            {children}
            <Analytics />
            <SpeedInsights />
          </AuthSessionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
