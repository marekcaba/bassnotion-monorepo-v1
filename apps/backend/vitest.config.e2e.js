import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./e2e/setup.ts'],
        include: ['./e2e/**/*.e2e-spec.ts'],
        exclude: ['./e2e/factories/**/*', './e2e/mocks/**/*'],
        testTimeout: 30000,
        hookTimeout: 30000,
        env: {
            NODE_ENV: 'test',
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@test': resolve(__dirname, './test'),
            '@e2e': resolve(__dirname, './e2e'),
        },
    },
});
