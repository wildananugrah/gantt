import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    'rgb(var(--color-ink) / <alpha-value>)',
        paper:  'rgb(var(--color-paper) / <alpha-value>)',
        mist:   'rgb(var(--color-mist) / <alpha-value>)',
        rule:   'rgb(var(--color-rule) / <alpha-value>)',
        muted:  'rgb(var(--color-muted) / <alpha-value>)',
        focus:  'rgb(var(--color-focus) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
