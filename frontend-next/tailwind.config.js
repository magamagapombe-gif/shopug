/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#E85D04", dark: "#C44B00", light: "#FF7F38" },
      },
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        display: ["'Syne'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
