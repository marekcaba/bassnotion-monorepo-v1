import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { cpus } from 'os';

console.log('VITEST CONFIG: __dirname =', __dirname);
console.log('VITEST CONFIG: process.cwd() =', process.cwd());

const aliasPath = resolve(__dirname, 'apps/frontend/src/$1');
console.log('VITEST CONFIG: @/ alias replacement =', aliasPath);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'apps/frontend/src'),
      '@bassnotion/contracts': resolve(__dirname, 'libs/contracts/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./apps/frontend/src/test/setup.ts'],
    // Advanced memory management
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: process.env.CI === 'true',
        maxThreads: process.env.CI === 'true' ? 1 : 2,
        minThreads: 1,
        isolate: true,
      },
    },
    // Test execution optimization
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    // Memory cleanup configuration
    sequence: {
      shuffle: false,
      concurrent: false, // Prevent memory accumulation
    },
    // Worker configuration for stability
    maxConcurrency: process.env.CI === 'true' ? 1 : 4,
    // Coverage optimization
    coverage: {
      provider: 'v8',
      enabled: false, // Disable by default to save memory
      clean: true,
      cleanOnRerun: true,
    },
    // File watching optimization
    watch: false,
    // Reporter optimization
    reporters: process.env.CI === 'true' ? ['basic'] : ['default'],
    // Dependency optimization
    deps: {
      inline: [
        /^(?!.*node_modules).*$/,
        '@testing-library/jest-dom',
        'vitest-canvas-mock',
      ],
      external: [
        'canvas',
        'jsdom',
      ],
    },
    // Memory leak detection
    logHeapUsage: process.env.NODE_ENV === 'development',
    // File inclusion/exclusion
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/coverage/**',
    ],
  },
  // Vite optimization for tests
  esbuild: {
    target: 'node14',
  },
  // Build optimization
  optimizeDeps: {
    include: ['@testing-library/react', '@testing-library/user-event'],
    exclude: ['canvas'],
  },
}); 