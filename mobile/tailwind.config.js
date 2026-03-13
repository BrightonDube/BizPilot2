/**
 * Tailwind CSS configuration for NativeWind.
 *
 * Why NativeWind?
 * It provides Tailwind CSS utilities in React Native, giving us
 * style parity with the web app (which uses Tailwind CSS v4).
 * This means designers and devs work with the same utility classes.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Match the web app's dark theme palette
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        surface: {
          DEFAULT: "#1f2937", // gray-800 — primary background
          light: "#374151",   // gray-700 — card/elevated surface
          dark: "#111827",    // gray-900 — deepest background
        },
        muted: "#9ca3af",     // gray-400 — secondary text
      },
    },
  },
  plugins: [],
};
