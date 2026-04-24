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
      },
      animation: {
        "vinyl-swap": "vinylSwap 0.72s cubic-bezier(0.4, 0, 0.2, 1) both",
      },
      fontFamily: {
        display: ['"ZCOOL XiaoWei"', "serif"],
        sans: ['"Nunito"', "system-ui", "sans-serif"],
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
        netease: {
          bg: "#2d2d2d",
          panel: "#2b2b2b",
          line: "#3a3a3a",
          accent: "#c62f2f",
          sub: "#888",
        },
      },
      backgroundImage: {
        "romantic-mesh":
          "radial-gradient(ellipse 120% 80% at 20% 10%, rgba(255, 182, 193, 0.45), transparent 50%), radial-gradient(ellipse 100% 60% at 80% 90%, rgba(255, 218, 185, 0.4), transparent 50%), linear-gradient(165deg, #fff5f0 0%, #ffe4ec 40%, #ffd6e0 100%)",
      },
    },
  },
  plugins: [],
};
