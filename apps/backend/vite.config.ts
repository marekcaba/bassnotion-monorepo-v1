/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

export default defineConfig({
  cwd: projectRoot,
  build: {
    ssr: true,
    target: 'node20',
    outDir: path.join(projectRoot, 'dist/apps/backend'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, './src/main.ts'),
      output: {
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        dir: path.join(projectRoot, 'dist/apps/backend')
      },
      external: [
        'node:*',
        '@nestjs/core',
        '@nestjs/common',
        '@nestjs/platform-express',
        '@nestjs/platform-fastify',
        '@nestjs/config',
        'fastify',
        'rxjs',
        'reflect-metadata',
        'dotenv',
        '@supabase/supabase-js',
        '@fastify/static',
        '@fastify/view',
        'class-transformer',
        'class-validator',
        '@bassnotion/contracts'
      ]
    }
  },
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.spec.ts', '**/*.integration-spec.ts', '**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}); 