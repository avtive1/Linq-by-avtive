import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@clerk/nextjs";
import { validateRequiredEnv } from "@/lib/env";
import "./globals.css";

if (process.env.NEXT_RUNTIME !== "edge") {
  validateRequiredEnv([
    "NEXT_PUBLIC_APP_URL",
    "DATABASE_URL",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
  ]);
}

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
  title: "Linq — Your Conference Card",
  description: "Register once. Generate a card for every event you attend.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable} font-sans`}
    >
      <body suppressHydrationWarning className={dmSans.className}>
        <ClerkProvider>
          <Toaster position="top-center" richColors />
          {children}
          <Analytics />
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  );
}
