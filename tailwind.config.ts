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
          DEFAULT: "#1c1c1e",
          foreground: "#ffffff",
        },
        ink: "#1c1c1e",
        charcoal: "#2c2c34",
        slate: "#555a6a",
        steel: "#6b6f7e",
        stone: "#8e91a0",
        canvas: "#ffffff",
        surface: "#f7f8fa",
        "surface-soft": "#fafbfc",
        "brand-yellow": "#ffd02f",
        "brand-blue": "#4262ff",
        "yellow-dark": "#746019",
        hairline: "#e0e2e8",
        "hairline-soft": "#eef0f3",
        "hairline-strong": "#c7cad5",
        border: "#e0e2e8",
        muted: "#6b6f7e",
        heading: "#1c1c1e",
        "light-1": "#fff8e0",
        "light-2": "#fafbfc",
        "light-3": "#f7f8fa",
        "primary-strong": "#2c2c34",
        success: "#00b473",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
