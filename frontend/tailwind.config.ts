import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        uti: {
          blue: "#003087",
          gold: "#F5A623",
        },
      },
    },
  },
  plugins: [],
};

export default config;
