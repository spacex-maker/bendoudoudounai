/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        vinylSwap: {
          "0%": { transform: "scale(1)", opacity: "1", filter: "brightness(1) blur(0)" },
          "42%": {
            transform: "scale(0.86)",
            opacity: "0.22",
            filter: "brightness(0.55) blur(8px)",
          },
          "100%": { transform: "scale(1)", opacity: "1", filter: "brightness(1) blur(0)" },
        },
        playModeTip: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.92)" },
          "14%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "72%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
        },
        landFadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        landFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        landSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        landSpinSlow: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        landEq: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        landPulseRing: {
          "0%": { opacity: "0.55", transform: "scale(0.92)" },
          "70%": { opacity: "0", transform: "scale(1.18)" },
          "100%": { opacity: "0", transform: "scale(1.18)" },
        },
        landProgress: {
          "0%": { width: "18%" },
          "50%": { width: "78%" },
          "100%": { width: "42%" },
        },
        landDrift: {
          "0%, 100%": { transform: "translate(0, 0)", opacity: "0.35" },
          "50%": { transform: "translate(12px, -18px)", opacity: "0.7" },
        },
        landGridShift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "48px 48px" },
        },
        landShine: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(220%) skewX(-18deg)" },
        },
        wallDrift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(18px,-22px,0) scale(1.04)" },
        },
        wallLetterIn: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        wallInk: {
          "0%, 100%": { opacity: "0.35", transform: "translateY(0)" },
          "50%": { opacity: "0.7", transform: "translateY(-12px)" },
        },
      },
      animation: {
        "vinyl-swap": "vinylSwap 0.72s cubic-bezier(0.4, 0, 0.2, 1) both",
        "play-mode-tip": "playModeTip 1.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "land-fade-up": "landFadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "land-float": "landFloat 7s ease-in-out infinite",
        "land-spin": "landSpin 18s linear infinite",
        "land-spin-slow": "landSpinSlow 36s linear infinite",
        "land-eq": "landEq 1.1s ease-in-out infinite",
        "land-pulse-ring": "landPulseRing 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "land-progress": "landProgress 8s ease-in-out infinite",
        "land-drift": "landDrift 9s ease-in-out infinite",
        "land-grid": "landGridShift 22s linear infinite",
        "land-shine": "landShine 4.5s ease-in-out infinite",
        "wall-drift": "wallDrift 14s ease-in-out infinite",
        "wall-letter-in": "wallLetterIn 0.85s cubic-bezier(0.22, 1, 0.36, 1) both",
        "wall-ink": "wallInk 9s ease-in-out infinite",
      },
      fontFamily: {
        display: ['"Syne"', '"Noto Sans SC"', "system-ui", "sans-serif"],
        letter: ['"Instrument Serif"', '"Noto Serif SC"', '"Noto Sans SC"', "Georgia", "serif"],
        sans: ['"Manrope"', '"Noto Sans SC"', "system-ui", "sans-serif"],
      },
      colors: {
        warm: {
          50: "#fff8f5",
          100: "#ffeee8",
          200: "#ffd4c7",
          300: "#ffb3a0",
          400: "#f48b7a",
          500: "#d4656a",
          600: "#b84d55",
        },
        ink: {
          50: "#F4F5F7",
          100: "#E8ECF1",
          200: "#D5DBE3",
          700: "#3A4149",
          800: "#1A1F26",
          900: "#0B0D10",
        },
        netease: {
          bg: "#2d2d2d",
          panel: "#2b2b2b",
          line: "#3a3a3a",
          accent: "#c62f2f",
          sub: "#888",
        },
        music: {
          accent: "#c62f2f",
        },
      },
      backgroundImage: {
        "romantic-mesh":
          "radial-gradient(ellipse 120% 80% at 20% 10%, rgba(255, 182, 193, 0.45), transparent 50%), radial-gradient(ellipse 100% 60% at 80% 90%, rgba(255, 218, 185, 0.4), transparent 50%), linear-gradient(165deg, #fff5f0 0%, #ffe4ec 40%, #ffd6e0 100%)",
        "product-mesh":
          "radial-gradient(ellipse 90% 60% at 85% 15%, rgba(198, 47, 47, 0.09), transparent 50%), radial-gradient(ellipse 70% 50% at 10% 80%, rgba(26, 31, 38, 0.06), transparent 45%), linear-gradient(165deg, #F4F5F7 0%, #E8ECF1 55%, #DEE3EA 100%)",
      },
    },
  },
  plugins: [],
};
