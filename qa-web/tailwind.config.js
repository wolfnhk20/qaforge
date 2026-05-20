/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B1020',
        surface: '#121A2B',
        elevated: '#182338',
        border: '#25324A',
        ink: '#F4F7FB',
        muted: '#9FB0C7',
        faint: '#5A7290',
        accent: {
          blue: '#4EA1FF',
          green: '#31D0AA',
          amber: '#F5B942',
          red: '#FF6B6B',
        },
      },
      boxShadow: {
        panel: '0 18px 45px rgba(0, 0, 0, 0.25)',
      },
      backgroundImage: {
        'panel-grid':
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
      fontFamily: {
        sans: ['"Aptos"', '"Segoe UI Variable"', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"SFMono-Regular"', 'monospace'],
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
