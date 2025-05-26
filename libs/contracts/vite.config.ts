import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: '../../dist/libs/contracts',
    }),
  ],
  build: {
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'source',
    },
    rollupOptions: {
      external: [
        'node:*'
      ]
    },
    outDir: '../../dist/libs/contracts',
  }
}); 