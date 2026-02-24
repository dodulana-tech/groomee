import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2D6A4F",
          50: "#F0FAF2",
          100: "#D8F3DC",
          200: "#A7E8B5",
          300: "#74D48F",
          400: "#52B788",
          500: "#40916C",
          600: "#2D6A4F",
          700: "#1B4332",
          800: "#0D2B1E",
          900: "#051610",
        },
        forest: {
          DEFAULT: "#1A3A2A",
          50: "#F0FAF2",
          100: "#D8F3DC",
          200: "#A7E8B5",
          300: "#52B788",
          400: "#2D6A4F",
          500: "#1A3A2A",
          600: "#112618",
          700: "#091510",
        },
        amber: {
          DEFAULT: "#D4A853",
          50: "#FDF8EE",
          100: "#FAF0D7",
          200: "#F2DAAA",
          300: "#E8C274",
          400: "#D4A853",
          500: "#B8893A",
          600: "#936B28",
        },
        cream: {
          DEFAULT: "#F7F3ED",
          50: "#FDFCFA",
          100: "#F7F3ED",
          200: "#EDE5D8",
          300: "#DDD0BC",
        },
        ember: {
          DEFAULT: "#FF4D2E",
          50: "#FFF1EE",
          100: "#FFD5CC",
          400: "#FF6B4A",
          500: "#FF4D2E",
          600: "#E03518",
        },
        accent: {
          DEFAULT: "#FF6B35",
          50: "#FFF3EE",
          100: "#FFE4D5",
          200: "#FFC4A3",
          300: "#FFA070",
          400: "#FF6B35",
          500: "#E84E18",
          600: "#C03B0E",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      animation: {
        "pulse-dot": "pulse-dot 1.5s ease-in-out infinite",
        "fade-up": "fade-up 0.4s ease forwards",
        "slide-up": "slide-up 0.5s ease forwards",
        shimmer: "shimmer 1.5s infinite",
        "bounce-light": "bounce-light 2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
        "spin-slow": "spin 2s linear infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "bounce-light": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(26,58,42,0.3)" },
          "70%": { boxShadow: "0 0 0 12px rgba(26,58,42,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(26,58,42,0)" },
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        green: "0 8px 24px rgba(45,106,79,0.25)",
        amber: "0 8px 24px rgba(212,168,83,0.3)",
        orange: "0 8px 24px rgba(255,107,53,0.25)",
        ember: "0 8px 24px rgba(255,77,46,0.3)",
        modal: "0 20px 60px rgba(0,0,0,0.15)",
        sheet: "0 -8px 40px rgba(0,0,0,0.12)",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },
      backgroundImage: {
        "hero-pattern":
          "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)",
        "dot-pattern":
          "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
        grain:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
