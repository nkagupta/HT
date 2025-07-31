/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f8f9f5',
          100: '#f1f3eb',
          200: '#e3e7d6',
          300: '#d0d7bb',
          400: '#b8c298',
          500: '#9ca877',
          600: '#808c5d',
          700: '#656e4a',
          800: '#53593e',
          900: '#474c36',
        },
      },
    },
  },
  plugins: [],
};