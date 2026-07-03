import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0f1a',
          900: '#0f1626',
          800: '#16203a',
          700: '#1f2c4d',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
