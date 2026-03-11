import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // AKYRA Jungle Theme
        akyra: {
          bg: "#0D1117",
          bgSecondary: "#161B22",
          surface: "#21262D",
          border: "#30363D",
          // Jungle greens
          green: "#2EA043",
          greenLight: "#56D364",
          greenDark: "#1A7F37",
          // Gold / AKY
          gold: "#E3B341",
          goldLight: "#F2CC60",
          goldDark: "#BB8009",
          // Danger
          red: "#F85149",
          redDark: "#DA3633",
          // Info
          blue: "#58A6FF",
          blueDark: "#388BFD",
          // Purple
          purple: "#BC8CFF",
          purpleDark: "#8957E5",
          // Orange
          orange: "#F0883E",
          // Text
          text: "#E6EDF3",
          textSecondary: "#8B949E",
          textDisabled: "#484F58",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "monospace"],
        body: ["var(--font-body)", "monospace"],
        sans: ["var(--font-sans)", "sans-serif"],
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
          "0%, 100%": { boxShadow: "0 0 8px rgba(46,160,67,0.4)" },
          "50%": { boxShadow: "0 0 20px rgba(46,160,67,0.8)" },
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
          "linear-gradient(135deg, #0D1117 0%, #0D1F0D 50%, #0D1117 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
