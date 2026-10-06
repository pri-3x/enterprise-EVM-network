/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0e1420', 900: '#162033', 700: '#3d4d66', 500: '#6b7c93', 200: '#d5deea', 100: '#eef2f7', 50: '#f7f9fb' },
        accent: { 700: '#0f6e56', 600: '#12805f', 100: '#e5f6ef' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
