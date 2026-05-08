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
    },
  },
  plugins: [],
}
