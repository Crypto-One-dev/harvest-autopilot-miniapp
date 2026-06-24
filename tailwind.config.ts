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
        background: "var(--background)",
        foreground: "var(--foreground)",
        harvest: {
          yellow: "#FFB833",
          "yellow-dark": "#E5A020",
          "tab-bg": "#F0C060",
          "btn-disabled": "#FFE0A3",
          "btn-disabled-text": "#C4841A",
          input: "#F1F4F4",
          green: "#15803D",
          "chart-yellow": "#F59E0B",
        },
      },
      borderRadius: {
        card: "28px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0, 0, 0, 0.08)",
        pill: "0 2px 8px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
