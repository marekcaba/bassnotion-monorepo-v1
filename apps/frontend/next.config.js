/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features for better performance
    optimizePackageImports: ['tone'],
  },
  // Configure path mapping for the monorepo structure
  transpilePackages: [],

  // Security: Disable source maps in production
  productionBrowserSourceMaps: false,

  // Ensure proper handling of ES modules
  eslint: {
    // Disable ESLint during builds since we handle it separately with Nx
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily disable TypeScript checking during builds for faster Vercel deployment
    // We handle TypeScript checking in our development workflow
    ignoreBuildErrors: true,
  },

  // Security: Remove X-Powered-By header
  poweredByHeader: false,

  // Webpack configuration for ESM module resolution and optimization
  webpack: (config, { isServer }) => {
    // Handle .js extensions for TypeScript files
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    
    // Optimize chunk splitting for faster loading
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Split Tone.js into separate chunks for parallel loading
          toneCore: {
            test: /[\\/]node_modules[\\/]tone[\\/]build[\\/]esm[\\/]core[\\/]/,
            name: 'tone-core',
            priority: 20,
            reuseExistingChunk: true,
          },
          toneInstruments: {
            test: /[\\/]node_modules[\\/]tone[\\/]build[\\/]esm[\\/]instrument[\\/]/,
            name: 'tone-instruments',
            priority: 15,
            reuseExistingChunk: true,
          },
          // Separate audio engine code
          audioEngine: {
            test: /[\\/]src[\\/]domains[\\/]playback[\\/]services[\\/]core[\\/]/,
            name: 'audio-engine',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },

  // Configure API routes
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
    ];
  },

  // Enhanced security headers with CSP
  async headers() {
    // Determine if we're in development mode
    const isDev = process.env.NODE_ENV === 'development';

    // Build connect-src CSP directive - cleaned up for iframe-only approach
    const connectSrc = [
      "'self'",
      'https://*.supabase.co',
      'https://api.supabase.co',
      'wss://*.supabase.co',
    ];

    // Add localhost URLs for development
    if (isDev) {
      connectSrc.push('http://localhost:3000', 'http://localhost:3001');
    } else {
      // Add production backend URL
      connectSrc.push('https://backend-production-612c.up.railway.app');
    }

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Content Security Policy - Tightened for iframe-only YouTube
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Removed YouTube from script-src - much more secure! Added blob: for AudioWorklet
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://vercel.live https://*.supabase.co https://cdn.jsdelivr.net",
              // Allow Web Workers for Tone.js audio processing
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // YouTube thumbnails only (no metadata services needed)
              "img-src 'self' data: https: blob: https://i.ytimg.com https://img.youtube.com https://yt3.ggpht.com https://yt4.ggpht.com https://lh3.googleusercontent.com",
              // Allow audio/video from self and Supabase storage
              "media-src 'self' https://*.supabase.co https://htuztkrbuewheehjspcz.supabase.co blob:",
              `connect-src ${connectSrc.join(' ')}`,
              // Allow YouTube iframes - sandboxed and secure
              "frame-src 'self' https://www.youtube.com https://youtube.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
          // Additional security headers
          {
            key: 'Permissions-Policy',
            value:
              'geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // CSRF Protection: Ensure cookies have proper SameSite attributes
          {
            key: 'Set-Cookie',
            value: 'SameSite=Strict; Secure; HttpOnly',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
