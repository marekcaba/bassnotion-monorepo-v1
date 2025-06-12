/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/setup.ts'],
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    pool: 'threads',
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    deps: {
      external: [],
      inline: ['undici'],
    },
    isolate: true,
  },
});
