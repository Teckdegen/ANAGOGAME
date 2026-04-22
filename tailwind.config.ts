import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dog cartoon palette — pulled from the French Bulldog image
        bg:      '#5B4AE8',   // vivid purple background (matches image bg exactly)
        card:    '#FFFFFF',   // white card (the diamond shape)
        'card-inner': '#F0EBFF', // very light purple tint for inner sections
        purple:  '#7B5CE8',   // medium purple (dog tag color)
        'purple-dark': '#3D2B8E', // deep purple for pressed states
        orange:  '#E8820C',   // collar orange
        'orange-dark': '#B85A06',
        brown:   '#5C3317',   // dog body brown
        'brown-light': '#8B5E3C',
        pink:    '#F4A0A0',   // ear pink
        gold:    '#FAD933',   // yellow accent
        ink:     '#1A0808',   // thick outline color
        'ink-light': '#2D1515',
      },
      fontFamily: {
        cartoon: ['Fredoka One', 'Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cartoon:    '0 6px 0 #1A0808',
        'cartoon-sm': '0 3px 0 #1A0808',
        'cartoon-lg': '0 10px 0 #1A0808',
        'card':     '0 8px 0 #1A0808, 0 0 0 4px #1A0808',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}

export default config
