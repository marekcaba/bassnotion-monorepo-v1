const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features for better performance
    // Optimize imports for large packages to improve tree-shaking
    optimizePackageImports: [
      'tone',
      'three',
      '@react-three/drei',
      'vexflow',
      'opensheetmusicdisplay',
    ],
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

    // Exclude server-only Sentry packages from client bundle
    // These packages (orchestrion_js.js, tracing-hooks) are Node.js-only
    // and add ~3.3MB to client bundle unnecessarily
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@sentry/node': false,
        '@sentry/node-core': false,
        '@apm-js-collab/tracing-hooks': false,
        '@apm-js-collab/code-transformer': false,
      };
    }

    // Optimize chunk splitting for faster loading
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Split Three.js core into its own chunk (~600KB savings from main bundle)
          // This is the largest 3D library and should load separately
          threeCore: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three-core',
            chunks: 'all',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Split React Three Fiber bindings into a separate chunk
          // Depends on three-core, so lower priority to ensure proper chunking
          reactThree: {
            test: /[\\/]node_modules[\\/]@react-three[\\/]/,
            name: 'react-three',
            chunks: 'all',
            priority: 25,
            reuseExistingChunk: true,
          },
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
          // Split Sheet Music libraries into their own chunk (~500KB savings)
          // VexFlow and OpenSheetMusicDisplay are only used in notation components
          sheetMusic: {
            test: /[\\/]node_modules[\\/](vexflow|opensheetmusicdisplay)[\\/]/,
            name: 'sheet-music',
            chunks: 'all',
            priority: 18,
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
      // Bunny Stream CDN for video player (primary)
      'https://*.mediadelivery.net',
      'https://*.bunnycdn.com',
      'https://assets.mediadelivery.net',
      // Vimeo API for video player (legacy support)
      'https://vimeo.com',
      'https://*.vimeo.com',
      'https://*.vimeocdn.com',
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
              // Added blob: for AudioWorklet, assets.mediadelivery.net for Bunny Stream Player.js
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://vercel.live https://*.supabase.co https://cdn.jsdelivr.net https://assets.mediadelivery.net",
              // Allow Web Workers for Tone.js audio processing
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // YouTube thumbnails only (no metadata services needed)
              "img-src 'self' data: https: blob: https://i.ytimg.com https://img.youtube.com https://yt3.ggpht.com https://yt4.ggpht.com https://lh3.googleusercontent.com",
              // Allow audio/video from self and Supabase storage
              "media-src 'self' https://*.supabase.co https://htuztkrbuewheehjspcz.supabase.co blob:",
              `connect-src ${connectSrc.join(' ')}`,
              // Allow YouTube, Bunny Stream, and Vimeo iframes - sandboxed and secure
              "frame-src 'self' https://www.youtube.com https://youtube.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://player.vimeo.com https://vimeo.com",
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

module.exports = withBundleAnalyzer(nextConfig);
