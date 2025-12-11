/**
 * Next.js Configuration with Bundle Analyzer
 *
 * Run with: ANALYZE=true pnpm build
 */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const baseConfig = require('./next.config.js');

// Enhance the base config with bundle analyzer
module.exports = withBundleAnalyzer({
  ...baseConfig,

  // Add bundle size limits
  experimental: {
    ...baseConfig.experimental,
    webpackBuildWorker: true,
  },

  // Enhanced webpack config for analysis
  webpack: (config, options) => {
    // Call the base webpack config first
    const newConfig = baseConfig.webpack
      ? baseConfig.webpack(config, options)
      : config;

    if (!options.isServer && process.env.ANALYZE === 'true') {
      // Add more detailed chunk naming for analysis
      newConfig.optimization.chunkIds = 'named';
      newConfig.optimization.moduleIds = 'named';
    }

    return newConfig;
  },
});
