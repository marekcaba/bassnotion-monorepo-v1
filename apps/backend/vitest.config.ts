/// <reference types="vitest" />

import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import swc from 'unplugin-swc';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/backend',
  plugins: [nxViteTsPaths(), swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.spec.ts',
    ],
    exclude: [
      'src/**/*.e2e-spec.ts', // Exclude E2E tests from unit test runs
      'src/**/*.integration.spec.ts', // Run integration tests separately
      'e2e/**/*',
      'node_modules/**/*',
      'dist/**/*',
    ],
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/test/**',
        '**/e2e/**',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    // Improve test isolation and mock handling
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Ensure proper environment variable handling
    env: {
      NODE_ENV: 'test',
    },
  },
});
