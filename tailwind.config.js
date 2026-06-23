/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/shared/public/index.html',
    './src/shared/public/js/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
