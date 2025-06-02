/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features if needed
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
    // Disable TypeScript checking during builds since we handle it separately with Nx
    ignoreBuildErrors: true,
  },

  // Security: Remove X-Powered-By header
  poweredByHeader: false,

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
    
    // Build connect-src CSP directive with localhost for development
    const connectSrc = [
      "'self'",
      "https://*.supabase.co",
      "https://api.supabase.co", 
      "wss://*.supabase.co"
    ];
    
    // Add localhost URLs for development
    if (isDev) {
      connectSrc.push("http://localhost:3000", "http://localhost:3001");
    } else {
      // Add production backend URL
      connectSrc.push("https://backend-production-612c.up.railway.app");
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
          // Content Security Policy to prevent XSS
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.supabase.co https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https:",
              `connect-src ${connectSrc.join(' ')}`,
              "frame-src 'none'",
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
