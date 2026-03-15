import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // AKYRA Papyrus Theme
        akyra: {
          bg: "#f7f4ef",
          bgSecondary: "#e8e2d8",
          surface: "#e8e2d8",
          border: "#d4cdc4",
          // Primary blues
          green: "#1a3080",
          greenLight: "#2a50c8",
          greenDark: "#111e52",
          // Gold / AKY
          gold: "#c8a96e",
          goldLight: "#dbc28a",
          goldDark: "#a08540",
          // Danger
          red: "#c0392b",
          redDark: "#962d22",
          // Info
          blue: "#2a50c8",
          blueDark: "#1a3080",
          // Purple
          purple: "#6c5ce7",
          purpleDark: "#4a3db0",
          // Orange
          orange: "#d4820a",
          // Text
          text: "#3c3630",
          textSecondary: "#8a7f72",
          textDisabled: "#b0a898",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
        stats: ["var(--font-stats)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "float-retro": "floatRetro 3s steps(4, end) infinite",
        blink: "blink 1s steps(2, end) infinite",
        fadeIn: "fadeIn 0.5s ease-out forwards",
        slideUp: "slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        shimmer: "shimmer 2s linear infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "jungle-sway": "jungleSway 4s ease-in-out infinite",
      },
      keyframes: {
        floatRetro: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(26,48,128,0.4)" },
          "50%": { boxShadow: "0 0 20px rgba(26,48,128,0.8)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        jungleSway: {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
      },
      backgroundImage: {
        "jungle-gradient":
          "linear-gradient(135deg, #f7f4ef 0%, #ede8df 50%, #f7f4ef 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
