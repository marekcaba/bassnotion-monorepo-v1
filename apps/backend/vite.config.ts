/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

export default defineConfig({
  build: {
    ssr: true,
    target: 'node20',
    outDir: path.join(projectRoot, 'dist/apps/backend'),
    emptyOutDir: true,
    minify: false, // Keep false for debugging, can enable later if needed
    sourcemap: true, // Useful for debugging
    rollupOptions: {
      input: path.resolve(__dirname, './src/main.ts'),
      output: {
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        dir: path.join(projectRoot, 'dist/apps/backend'),
      },
      // Externalize NestJS and Node.js built-in modules to prevent them from being bundled
      external: [
        'node:*',
        '@nestjs/core',
        '@nestjs/common',
        '@nestjs/platform-fastify',
        '@nestjs/config',
        '@nestjs/cqrs',
        '@nestjs/testing',
        'fastify',
        'rxjs',
        'reflect-metadata',
        'dotenv',
        '@supabase/supabase-js',
        '@fastify/static',
        '@fastify/view',
        'class-transformer',
        'class-validator',
        '@bassnotion/contracts',
      ],
      treeshake: false, // Keep false for debugging, can enable later if needed
    },
  },
  plugins: [
    // SWC plugin for Vite - crucial for NestJS decorators
    swc.vite({
      tsconfigFile: './tsconfig.app.json', // Path to your backend's tsconfig
      jsc: {
        parser: {
          syntax: 'typescript',
          // Enable these for decorator support
          decorators: true,
        },
        transform: {
          // Crucial for NestJS DI
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021', // Ensure this matches your tsconfig target
      },
    }) as any,
    tsconfigPaths() as any, // Ensure this is after the SWC plugin if there are interactions
  ],
  // This is important for NestJS: make sure it's not trying to optimize deps
  // that are only loaded via DI.
  optimizeDeps: {
    exclude: [
      '@nestjs/microservices',
      '@nestjs/websockets',
      'cache-manager',
      'class-validator',
      'class-transformer',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});