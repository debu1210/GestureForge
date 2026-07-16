/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Adding custom neon glow shadows to match the Stark lab aesthetic
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(6, 182, 212, 0.15)',
        'neon-purple': '0 0 25px rgba(139, 92, 246, 0.15)',
      }
    },
  },
  plugins: [],
}
