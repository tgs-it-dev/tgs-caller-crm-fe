const defaultTheme = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2430",
        paper: "#FCFCFC",
        slate: "#8A94A3",
        navy: "#1F3A5F",
        status: {
          red: "#B5504A",
          green: "#4F8A5B",
          gold: "#C99A3E",
          blue: "#3E7CB1"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
}
