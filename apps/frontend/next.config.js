/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features if needed
  },
  // Configure path mapping for the monorepo structure
  transpilePackages: [],
  // Ensure proper handling of ES modules
  eslint: {
    // Disable ESLint during builds since we handle it separately with Nx
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checking during builds since we handle it separately with Nx
    ignoreBuildErrors: true,
  },
  // Configure API routes
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:3000/auth/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
