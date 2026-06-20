const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { withSentryConfig } = require('@sentry/nextjs');

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

  // Source maps are generated for production builds so the Sentry plugin
  // can upload them and translate minified stack traces back to readable
  // file:line:col references. The Sentry plugin (configured in
  // withSentryConfig below with `hideSourceMaps: true`) strips the
  // .map files from the public output, so users never download them —
  // only Sentry has them.
  productionBrowserSourceMaps: true,

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
      // Vercel Live feedback widget on preview deploys (no-op in production)
      'https://vercel.live',
      'wss://ws-us3.pusher.com',
      // Sentry — the browser SDK posts events to *.ingest.<region>.sentry.io.
      // The wildcard covers the EU/US/dedicated regions our org could be in.
      'https://*.sentry.io',
      'https://*.ingest.sentry.io',
      'https://*.ingest.de.sentry.io',
      'https://*.ingest.us.sentry.io',
    ];

    // Add localhost URLs for development
    if (isDev) {
      connectSrc.push('http://localhost:3000', 'http://localhost:3001');
    } else {
      // Add the backend URL from env so production AND staging both work
      // (NEXT_PUBLIC_API_URL is scoped per Vercel environment: production
      // points at the production Railway service; preview at the staging one).
      // Falls back to the historical hardcoded production URL if the env var
      // is somehow missing at build time.
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        'https://backend-production-612c.up.railway.app';
      connectSrc.push(apiUrl);
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
            value: 'strict-origin-when-cross-origin',
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
              // Allow YouTube, Bunny Stream, Vimeo iframes - sandboxed and secure.
              // Also allow Vercel Live feedback widget on preview deploys (no-op in prod).
              "frame-src 'self' https://www.youtube.com https://youtube.com https://iframe.mediadelivery.net https://player.mediadelivery.net https://player.vimeo.com https://vimeo.com https://vercel.live",
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
            // microphone=(self): allow getUserMedia for OUR OWN origin only (still
            // blocks any third-party iframe). Needed for in-browser audio capture
            // (bass recording / practice tools); same-origin-only keeps the
            // hardening intact — was microphone=() which denied the mic to every
            // document, including ours. See docs/PRACTICE_TOOLS_FEASIBILITY.md.
            value:
              'geolocation=(), microphone=(self), camera=(), payment=(), usb=(), bluetooth=()',
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

// Wrap with Sentry — required for sentry.client.config.ts and
// instrumentation.ts (server/edge) to actually run. Without this the
// Sentry SDK is imported but never initialized.
//
// silent: only log to stdout in CI/dev so local builds aren't noisy.
// org/project are read from env so different teammates can point at
// their own Sentry projects without editing this file.
//
// Source-map upload is enabled only when SENTRY_AUTH_TOKEN is set —
// otherwise Sentry would 401 every build. Add the token as a
// SENTRY_AUTH_TOKEN env var in Vercel (and locally if you want
// source-map upload from your machine).
module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Don't upload source maps if no auth token is configured — keeps
  // builds working without the Sentry account being set up locally.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Hides the SDK initialization breadcrumbs and other dev-time noise.
  hideSourceMaps: true,
  // Upload source maps for *all* JS chunks, not just the ones Sentry can
  // auto-detect as source-map references. Required because our custom
  // splitChunks config in `webpack:` above renames/splits chunks after
  // Sentry's debug-id injection — leaving served chunks with debug IDs
  // that don't match the uploaded maps. With widenClientFileUpload Sentry
  // uploads everything in .next/static, so debug-id lookup hits regardless
  // of which chunk the runtime ended up in.
  widenClientFileUpload: true,
  // Disable the tunnel for now — it routes Sentry events through a
  // Next.js API route to bypass ad blockers. Easy to enable later if
  // we see lots of dropped events.
  // tunnelRoute: '/monitoring',
});
