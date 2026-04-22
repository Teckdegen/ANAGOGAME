import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dog cartoon palette
        purple: {
          deep:   '#2E1E72',
          mid:    '#3D2B8E',
          card:   '#3D2B8E',
          light:  '#5B4BE8',
        },
        orange: {
          DEFAULT: '#E8820C',
          dark:    '#A85A08',
          light:   '#F0A040',
        },
        brown:  '#5C3317',
        pink:   '#F4A0A0',
        gold:   '#FAD933',
        ink:    '#140A0A',
      },
      fontFamily: {
        cartoon: ['Fredoka One', 'Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cartoon: '0 6px 0 #140A0A',
        'cartoon-sm': '0 3px 0 #140A0A',
      },
      borderWidth: { 3: '3px', 5: '5px' },
    },
  },
  plugins: [],
}

export default config
