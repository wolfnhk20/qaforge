import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs':  '480px',
      'sm':  '640px',
      'md':  '768px',
      'lg':  '1024px',
      'xl':  '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        bg:      '#080D18',
        surface: '#0D1525',
        s2:      '#111D30',
        s3:      '#162036',
        border:  '#1E2E45',
        b2:      '#283D58',
        ink:     '#EEF2F8',
        muted:   '#8FA5BE',
        faint:   '#4D6580',
        accent: {
          blue:  '#4EA1FF',
          green: '#2EC89A',
          amber: '#F0B429',
          red:   '#F56565',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'monospace'],
      },
      boxShadow: {
        panel:  '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px rgba(0,0,0,0.35)',
        card:   '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 4px 16px rgba(0,0,0,0.25)',
        glow:   '0 0 24px rgba(78,161,255,0.15)',
        'glow-green': '0 0 24px rgba(46,200,154,0.15)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'ping-slow': {
          '75%,100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        shimmer:    'shimmer 2.4s linear infinite',
        'scan-line':'scan-line 8s linear infinite',
        'ping-slow':'ping-slow 2s cubic-bezier(0,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
