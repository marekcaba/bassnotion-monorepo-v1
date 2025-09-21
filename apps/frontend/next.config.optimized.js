/**
 * Optimized Next.js Configuration
 * 
 * Performance optimizations for production builds
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features for better performance
    optimizePackageImports: [
      'tone',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@react-three/fiber',
      '@react-three/drei',
      'lucide-react',
    ],
    // Enable server components optimization
    serverComponentsExternalPackages: ['tone'],
    // Use turbopack for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Configure path mapping for the monorepo structure
  transpilePackages: ['@bassnotion/contracts'],

  // Security: Disable source maps in production
  productionBrowserSourceMaps: false,

  // Image optimization
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'yt3.ggpht.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Ensure proper handling of ES modules
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Security: Remove X-Powered-By header
  poweredByHeader: false,

  // Webpack configuration for ESM module resolution and optimization
  webpack: (config, { dev, isServer, webpack }) => {
    // Handle .js extensions for TypeScript files
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    
    // Production optimizations
    if (!dev && !isServer) {
      // Enable module concatenation
      config.optimization.concatenateModules = true;
      
      // Minimize bundle size
      config.optimization.minimize = true;
      
      // Advanced chunk splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          // Framework chunks
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|next)[\\/]/,
            name: 'framework',
            priority: 50,
            reuseExistingChunk: true,
          },
          
          // Tone.js chunks - split for parallel loading
          toneCore: {
            test: /[\\/]node_modules[\\/]tone[\\/]build[\\/]esm[\\/]core[\\/]/,
            name: 'tone-core',
            priority: 40,
            reuseExistingChunk: true,
            enforce: true,
          },
          toneInstruments: {
            test: /[\\/]node_modules[\\/]tone[\\/]build[\\/]esm[\\/]instrument[\\/]/,
            name: 'tone-instruments',
            priority: 35,
            reuseExistingChunk: true,
            enforce: true,
          },
          toneEffects: {
            test: /[\\/]node_modules[\\/]tone[\\/]build[\\/]esm[\\/]effect[\\/]/,
            name: 'tone-effects',
            priority: 30,
            reuseExistingChunk: true,
            enforce: true,
          },
          
          // Three.js chunks
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three',
            priority: 35,
            reuseExistingChunk: true,
          },
          threeAddons: {
            test: /[\\/]node_modules[\\/]@react-three[\\/]/,
            name: 'three-addons',
            priority: 30,
            reuseExistingChunk: true,
          },
          
          // UI library chunks
          radixUI: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix-ui',
            priority: 25,
            reuseExistingChunk: true,
          },
          
          // Playback domain chunks
          playbackCore: {
            test: /[\\/]src[\\/]domains[\\/]playback[\\/]modules[\\/](audio-engine|transport)[\\/]/,
            name: 'playback-core',
            priority: 20,
            reuseExistingChunk: true,
          },
          playbackInstruments: {
            test: /[\\/]src[\\/]domains[\\/]playback[\\/]modules[\\/]instruments[\\/]/,
            name: 'playback-instruments',
            priority: 15,
            reuseExistingChunk: true,
          },
          playbackServices: {
            test: /[\\/]src[\\/]domains[\\/]playback[\\/](services|repositories)[\\/]/,
            name: 'playback-services',
            priority: 10,
            reuseExistingChunk: true,
          },
          
          // Common vendor chunk
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              return `vendor-${packageName.replace('@', '')}`;
            },
            priority: 5,
            minChunks: 2,
          },
          
          // Default chunk
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      };
      
      // Add bundle size warnings
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000, // 500KB
        maxAssetSize: 512000,
      };
      
      // Add webpack bundle analyzer
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: './analyze.html',
            generateStatsFile: true,
            statsFilename: './stats.json',
          })
        );
      }
    }
    
    // Add aliases for cleaner imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@playback': '/src/domains/playback',
      '@ui': '/src/ui',
      '@shared': '/src/shared',
    };

    return config;
  },

  // Configure API routes
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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

  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    const connectSrc = [
      "'self'",
      'https://*.supabase.co',
      'https://api.supabase.co',
      'wss://*.supabase.co',
    ];

    if (isDev) {
      connectSrc.push('http://localhost:3000', 'http://localhost:3001');
    } else {
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
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://vercel.live https://*.supabase.co",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https://*.supabase.co blob:",
              `connect-src ${connectSrc.join(' ')}`,
              "frame-src 'self' https://www.youtube.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Enable SWC minification
  swcMinify: true,

  // Reduce JavaScript parsing time
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },
};

module.exports = nextConfig;