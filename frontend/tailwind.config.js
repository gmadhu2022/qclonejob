/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#10256b',
          50: '#eef1fa', 100: '#d6ddf2', 200: '#aab8e4',
          600: '#1a3a9e', 700: '#10256b', 800: '#0b1c54', 900: '#081543',
        },
        brandgreen: {
          DEFAULT: '#4faa38',
          50: '#eef8ea', 100: '#d6efcd', 400: '#6ec24f',
          500: '#4faa38', 600: '#41922e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,37,107,0.08), 0 1px 2px rgba(16,37,107,0.04)',
        cardhover: '0 10px 30px -10px rgba(16,37,107,0.25)',
      },
    },
  },
  plugins: [],
}
