/* Tailwind v3 config for option-2.html. Rebuild option-2.css after changing classes:
   npx tailwindcss@3.4.19 -c tailwind.config.js -i option-2.src.css -o option-2.css --minify */
module.exports = {
  content: ['./option-2.html', './option-2.js'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        brand: {
          blue: '#2563EB',
          blueHover: '#1D4ED8',
          blueLight: '#EFF6FF',
          green: '#16A34A',
          greenLight: '#DCFCE7',
          amber: '#D97706',
          amberLight: '#FEF3C7',
          rose: '#DC2626',
          roseLight: '#FEE2E2',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      }
    }
  }
};
