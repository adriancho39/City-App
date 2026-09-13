/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vitoria: {
          dark: '#0f291e',
          forest: '#1b4332',
          emerald: '#2d6a4f',
          mint: '#52b788',
          light: '#d8f3dc',
        },
        patrimonio: '#d97706',
        naturaleza: '#059669',
        cultura: '#7c3aed',
        gastronomia: '#e11d48',
        ocio: '#2563eb',
        comercio: '#0891b2',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
