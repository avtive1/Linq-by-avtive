import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-display",
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
    <html lang="en" className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} font-sans`}>
      <body className={plusJakartaSans.className}>
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
