/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Custom font families
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        'mono-display': [
          'var(--font-courier-prime)',
          'ui-monospace',
          'monospace',
        ],
        heading: [
          'var(--font-podium-sharp)',
          'var(--font-bebas-neue)',
          'Impact',
          'sans-serif',
        ],
        'dm-body': [
          'var(--font-dm-sans)',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
      },
      // Enhanced breakpoint system for better responsive design
      screens: {
        xs: '475px', // Extra small mobile landscape
        sm: '640px', // Small tablets (Tailwind default)
        md: '768px', // Medium tablets (Tailwind default)
        lg: '1024px', // Large laptops (Tailwind default)
        xl: '1280px', // Extra large desktops (Tailwind default)
        '2xl': '1536px', // 2X large screens (Tailwind default)
        // Custom breakpoints for specific use cases
        mobile: { max: '639px' }, // Mobile-only styles
        tablet: { min: '640px', max: '1023px' }, // Tablet range
        desktop: { min: '1024px' }, // Desktop and up
      },
      // Container queries for better component-level responsiveness
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          xs: '1rem',
          sm: '1.5rem',
          md: '2rem',
          lg: '2.5rem',
          xl: '3rem',
          '2xl': '4rem',
        },
        screens: {
          xs: '475px',
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1400px', // Slightly smaller max-width for better content reading
        },
      },
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Enhanced spacing for better responsive design
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      // Responsive font sizes
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        // Responsive text sizes
        'display-sm': ['2.25rem', { lineHeight: '2.5rem' }],
        'display-md': ['2.875rem', { lineHeight: '3.25rem' }],
        'display-lg': ['3.5rem', { lineHeight: '4rem' }],
      },
      // Enhanced border radius for better design consistency
      borderRadius: {
        xs: '0.125rem',
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      // Sparkle burst animation for like/favorite buttons
      keyframes: {
        'sparkle-burst': {
          '0%': {
            transform: 'translate(-50%, -50%) scale(0) rotate(0deg)',
            opacity: '1',
          },
          '100%': {
            transform:
              'translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(var(--sparkle-scale)) rotate(var(--sparkle-rotation))',
            opacity: '0',
          },
        },
        // Fade in animation for overlays
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        // Fade in with slight scale for content
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        // Slide up from below with fade
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(24px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        // Waveform bars animation for audio preview
        waveform: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '100%' },
        },
      },
      animation: {
        'sparkle-burst': 'sparkle-burst 600ms ease-out forwards',
        'fade-in': 'fadeIn 400ms ease-out',
        'fade-in-up': 'fadeInUp 400ms ease-out',
        'slide-up': 'slideUp 0.5s ease-out both',
        'slide-up-delayed': 'slideUp 0.5s ease-out 0.2s both',
        waveform: 'waveform 0.8s ease-in-out infinite',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
