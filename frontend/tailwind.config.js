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
        'gotham-black': '#121212',
        'gotham-blue': '#1a222c',
        'bat-yellow': '#ffdf00',
        'gotham-light': '#FFFFFF',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'pulse-subtle': 'pulse-subtle 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'dash-offset-300': 'dash-offset 1.5s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.2s ease-in-out',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'progress-indeterminate': 'progress-indeterminate 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 2px #ffdf00)' },
          '50%': { filter: 'drop-shadow(0 0 15px #ffdf00)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        },
        'dash-offset': {
          '0%': { strokeDashoffset: '0' },
          '50%': { strokeDashoffset: '240' },
          '100%': { strokeDashoffset: '0' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
