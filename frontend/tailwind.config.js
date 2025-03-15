/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gotham-dark': '#121212',
        'gotham-blue': '#1a222c',
        'bat-yellow': '#ffdf00',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 2px #ffdf00)' },
          '50%': { filter: 'drop-shadow(0 0 15px #ffdf00)' },
        },
      },
    },
  },
  plugins: [],
}
