import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#79D980", // Light Green
          foreground: "#23468C", // Dark Blue inside Green
        },
        surface: "#F9FAFB",
        border: "#E5E7EB",
        muted: "#6B7280",
        heading: "#23468C", // Dark Blue
        "light-1": "#DCE7D5",
        "light-2": "#EDF2E9",
        "light-3": "#DCE4F0",
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
