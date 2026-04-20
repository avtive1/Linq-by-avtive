import type { Metadata } from "next";
import { Inter, Poppins, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});


export const metadata: Metadata = {
  title: "Avtive — Your Conference Card",
  description: "Register once. Generate a card for every event you attend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${outfit.variable}`}>
      <body className={inter.className}>
        <Toaster position="top-center" richColors />
        {children}
        <Analytics />
      </body>
    </html>
  );
}