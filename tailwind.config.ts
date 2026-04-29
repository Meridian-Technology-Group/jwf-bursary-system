import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn/ui CSS variable mappings
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // JWF brand colors — indigo navy from johnwhitgiftfoundation.org (#282e68)
        primary: {
          50: "#F0F1F8",
          100: "#DEE0EE",
          200: "#B5BAD9",
          300: "#7E85B8",
          400: "#5860A3",
          500: "#3D4582",
          600: "#3c3c7b",
          700: "#2f3470",
          800: "#282e68",
          900: "#1F2454",
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          50: "#FDFAF2",
          100: "#FBF3E0",
          400: "#D4A83A",
          500: "#C9981E",
          600: "#B8862A",
          700: "#9A7022",
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        // Warm canvas tone for applicant-facing surfaces — JWF "less blank white"
        canvas: {
          50: "#FBFAF6",
          100: "#F6F4ED",
          200: "#EBE7DA",
        },
        success: { 50: "#F0FDF4", 600: "#16A34A" },
        warning: {
          50: "#FFFBEB",
          200: "#FDE68A",
          400: "#FBBF24",
          600: "#D97706",
        },
        error: { 50: "#FEF2F2", 200: "#FECACA", 600: "#DC2626" },
        info: {
          50: "#EFF6FF",
          200: "#BFDBFE",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        serif: [
          "var(--font-playfair)",
          "Playfair Display",
          "Georgia",
          "serif",
        ],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        full: "9999px",
        // Shadcn radius tokens
        DEFAULT: "calc(var(--radius))",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/forms"),
  ],
};

export default config;
