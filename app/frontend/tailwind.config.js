/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '360px',
      },
      colors: {
        phantom: {
          canvas: 'var(--phantom-color-canvas)',
          surface: 'var(--phantom-color-surface)',
          'surface-muted': 'var(--phantom-color-surface-muted)',
          'surface-raised': 'var(--phantom-color-surface-raised)',
          ink: 'var(--phantom-color-ink)',
          muted: 'var(--phantom-color-muted)',
          subtle: 'var(--phantom-color-subtle)',
          line: 'var(--phantom-color-line)',
          'line-strong': 'var(--phantom-color-line-strong)',
          accent: {
            DEFAULT: 'var(--phantom-color-accent)',
            hover: 'var(--phantom-color-accent-hover)',
            pressed: 'var(--phantom-color-accent-pressed)',
            soft: 'var(--phantom-color-accent-soft)',
          },
          focus: 'var(--phantom-color-focus)',
          disabled: 'var(--phantom-color-disabled)',
          success: {
            soft: 'var(--phantom-color-success-soft)',
            text: 'var(--phantom-color-success-text)',
            border: 'var(--phantom-color-success-border)',
          },
          danger: {
            soft: 'var(--phantom-color-danger-soft)',
            text: 'var(--phantom-color-danger-text)',
            border: 'var(--phantom-color-danger-border)',
          },
          severity: {
            critical: {
              DEFAULT: '#D32F2F',
              soft: '#FDECEC',
              text: '#A51F1F',
              border: '#F4B6B6',
            },
            high: {
              DEFAULT: '#F57C00',
              soft: '#FFF0DE',
              text: '#A84F00',
              border: '#FFD2A3',
            },
            medium: {
              DEFAULT: '#FBC02D',
              soft: '#FFF8D8',
              text: '#7A5A00',
              border: '#F8E39A',
            },
            low: {
              DEFAULT: '#388E3C',
              soft: '#EAF6EA',
              text: '#256B2B',
              border: '#B8DCBA',
            },
          },
        },
      },
      borderRadius: {
        'phantom-card': 'var(--phantom-radius-card)',
        'phantom-control': 'var(--phantom-radius-control)',
      },
      boxShadow: {
        'phantom-soft': 'var(--phantom-shadow-soft)',
        'phantom-lift': 'var(--phantom-shadow-lift)',
        'phantom-button': 'var(--phantom-shadow-button)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        'phantom-fast': '120ms',
        'phantom-base': '180ms',
        'phantom-slow': '240ms',
      },
      transitionTimingFunction: {
        'phantom-standard': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionProperty: {
        phantom: 'color, background-color, border-color, box-shadow, transform, opacity',
      },
      keyframes: {
        'phantom-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'phantom-fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'phantom-fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'phantom-scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'phantom-slide-in-right': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'phantom-pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'phantom-pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(255 123 71 / 0.45)' },
          '70%': { boxShadow: '0 0 0 6px rgb(255 123 71 / 0)' },
          '100%': { boxShadow: '0 0 0 0 rgb(255 123 71 / 0)' },
        },
        'phantom-pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.65' },
        },
        'phantom-bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'phantom-progress-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(255 123 71 / 0)' },
          '50%': { boxShadow: '0 0 14px 0 rgb(255 123 71 / 0.55)' },
        },
      },
      animation: {
        'phantom-fade-in': 'phantom-fade-in 220ms ease-out both',
        'phantom-fade-in-up': 'phantom-fade-in-up 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'phantom-fade-in-down': 'phantom-fade-in-down 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'phantom-scale-in': 'phantom-scale-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'phantom-slide-in-right': 'phantom-slide-in-right 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'phantom-pulse-soft': 'phantom-pulse-soft 2.2s ease-in-out infinite',
        'phantom-pulse-ring': 'phantom-pulse-ring 1.6s ease-out infinite',
        'phantom-pulse-dot': 'phantom-pulse-dot 1.6s ease-in-out infinite',
        'phantom-bounce-in': 'phantom-bounce-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'phantom-progress-glow': 'phantom-progress-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
