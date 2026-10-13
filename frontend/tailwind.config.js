/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'hospital-blue': {
          DEFAULT: '#004b87',
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9ddfd',
          300: '#7cc2fb',
          400: '#36a2f7',
          500: '#0c85e9',
          600: '#0066cc',
          700: '#004b87', // High contrast WCAG AAA compliant on white (>7:1)
          800: '#034177',
          900: '#073663',
          950: '#052342',
        },
        'emergency-red': {
          DEFAULT: '#b91c1c',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c', // High contrast WCAG AA/AAA compliant (>5.5:1)
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        'clinical-white': '#ffffff',
        'clinical-surface': '#f8fafc',
        'clinical-dark': '#0f172a', // WCAG AAA high contrast dark text (>15:1)
        'clinical-gray': '#334155',
        'clinical-green': {
          DEFAULT: '#15803d',
          700: '#15803d',
          800: '#166534',
        },
        'clinical-amber': {
          DEFAULT: '#b45309',
          700: '#b45309',
          800: '#92400e',
        },
      },
    },
  },
  plugins: [],
};
