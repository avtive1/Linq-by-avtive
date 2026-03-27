import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#375dfb",
          foreground: "#ffffff",
        },
        surface: "#F9FAFB",
        border: "#E5E7EB",
        muted: "#6B7280",
        heading: "#111827",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        xl: "10px",
        "2xl": "12px",
        full: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
