import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // AKYRA Observatory Theme — dark, immersive, living
        akyra: {
          bg: "#08080f",
          bgSecondary: "#0e0e18",
          surface: "#12121e",
          surfaceLight: "#1a1a2a",
          border: "#1f1f32",
          borderLight: "#2a2a40",
          // Primary accent (observatory blue)
          green: "#3b5bdb",
          greenLight: "#5c7cfa",
          greenDark: "#1a3080",
          // Gold / AKY
          gold: "#c8a96e",
          goldLight: "#dbc28a",
          goldDark: "#a08540",
          // Danger
          red: "#e03131",
          redDark: "#c92a2a",
          // Info
          blue: "#4dabf7",
          blueDark: "#339af0",
          // Purple
          purple: "#7950f2",
          purpleDark: "#6741d9",
          // Orange
          orange: "#fd7e14",
          // Text
          text: "#e8e4df",
          textSecondary: "#8a8494",
          textDisabled: "#4a4458",
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
        "orb-float": "orbFloat 6s ease-in-out infinite",
        breathe: "breathe 3s ease-in-out infinite",
        "inscription-reveal": "inscriptionReveal 1s ease-out forwards",
        "heartbeat-sweep": "heartbeatSweep 3s linear infinite",
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
        orbFloat: {
          "0%, 100%": { transform: "translateY(0) translateX(0)", opacity: "0.3" },
          "25%": { transform: "translateY(-20px) translateX(10px)", opacity: "0.8" },
          "50%": { transform: "translateY(-10px) translateX(-5px)", opacity: "0.5" },
          "75%": { transform: "translateY(-25px) translateX(15px)", opacity: "0.9" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        inscriptionReveal: {
          "0%": { opacity: "0", letterSpacing: "0.3em" },
          "100%": { opacity: "1", letterSpacing: "0.15em" },
        },
        heartbeatSweep: {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-1000" },
        },
      },
      backgroundImage: {
        "observatory-gradient":
          "radial-gradient(ellipse at 50% 0%, rgba(26,26,62,0.6) 0%, rgba(8,8,15,1) 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
