import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Admin Swiss dashboard ─────────────────────
        uti: {
          blue: "#003087",
          gold: "#F5A623",
        },
        ink:      "#0B0B0E",
        paper:    "#101014",
        surface:  "#16161B",
        gold:     "#F5A623",
        muted:    "#8A8A93",
        dim:      "#54545C",
        hairline: "rgba(255,255,255,0.07)",

        // ── Chat estudiante palette ───────────────────
        plum:     "#3D1E72",
        "plum-dk":"#2A1352",
        "plum-lt":"#5A36A0",
        "chat-orange":    "#E76E1F",
        "chat-orange-dk": "#C95812",
        cream:    "#FAF7F2",
        "chat-ink":  "#1A1130",
        "chat-soft": "#4A3D63",
      },
      fontFamily: {
        sans:  ["var(--font-inter)",             "ui-sans-serif",  "system-ui"],
        mono:  ["var(--font-jetbrains)",          "ui-monospace",   "monospace"],
        serif: ["var(--font-instrument-serif)",   "Georgia",        "serif"],
      },
      boxShadow: {
        card: "0 24px 60px -20px rgba(10,2,30,0.55), 0 4px 14px -6px rgba(10,2,30,0.4)",
        chip: "0 1px 2px rgba(26,17,48,0.06), 0 1px 1px rgba(26,17,48,0.04)",
      },
      animation: {
        "dash":       "dash 1.6s linear infinite",
        "slide-in":   "slideIn 240ms ease-out both",
        "fade-in":    "fadeIn 240ms ease-out both",
        "blink-cur":  "blink 1.2s steps(2,end) infinite",
        "spin-slow":  "spin 1.4s linear infinite",
        // chat
        "dot-bounce": "dotBounce 1.2s ease-in-out infinite",
        "chat-pop":   "chatPop 220ms cubic-bezier(.2,.9,.3,1.2) both",
        "chat-slide": "chatSlide 340ms cubic-bezier(.2,.7,.2,1) both",
      },
      keyframes: {
        dash:      { to: { "stroke-dashoffset": "-16" } },
        slideIn:   { from: { opacity: "0", transform: "translateX(20px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        blink:     { "50%": { opacity: "0" } },
        dotBounce: {
          "0%,80%,100%": { transform: "translateY(0)",    opacity: "0.4" },
          "40%":          { transform: "translateY(-4px)", opacity: "1" },
        },
        chatPop: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        chatSlide: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
