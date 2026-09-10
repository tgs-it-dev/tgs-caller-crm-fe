const defaultTheme = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2430",
        paper: "#FCFCFC",
        "shop-floor": "#EEF0F1",
        "nav-active": "#F3F7FB",
        slate: "#8A94A3",
        navy: "#1F3A5F",
        status: {
          red: "#B5504A",
          green: "#4F8A5B",
          gold: "#C99A3E",
          blue: "#3E7CB1"
        },
        // Figma variable names, kept verbatim so specs stay greppable.
        "signal-red": "#D64545",
        "relay-blue": "#2E7DB5",
        // Unnamed hex lifted from the Queue card.
        "table-strip": "#F8F8F8",
        // Pill borders in the workspace "Phone Matched" / "Source" chips.
        "pill-border": "#EFEFEF",
        // Body copy color for the workspace lead-summary paragraph.
        "body-text": "#656565",
        accent: {
          blue: "#0088FF"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", ...defaultTheme.fontFamily.sans]
      },
      // Every rule in the Figma file is a 0.5px slate hairline — card outlines,
      // card heading dividers, page header rules, table rows. Tailwind has no
      // sub-pixel border scale, so this replaces inline `borderWidth` styles.
      borderWidth: {
        hairline: "0.5px"
      }
    }
  },
  plugins: []
}
