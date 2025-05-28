/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./e2e/setup.ts'],
        include: ['e2e/**/*.e2e-spec.ts'],
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
            ],
        },
        env: {
            SUPABASE_URL: 'http://localhost:54321',
            SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
            SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
            PORT: '3001',
            API_PREFIX: 'api',
            TEST_USER_EMAIL: 'test@example.com',
            TEST_USER_PASSWORD: 'Password123!',
            JWT_SECRET: 'super-secret-jwt-token-with-at-least-32-characters-long',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@test': path.resolve(__dirname, './test'),
            '@e2e': path.resolve(__dirname, './e2e'),
            '@bassnotion/contracts': path.resolve(__dirname, '../bassnotion-contracts/src/types'),
            '@bassnotion/contracts/*': path.resolve(__dirname, '../bassnotion-contracts/src/types/*'),
        },
    },
});
