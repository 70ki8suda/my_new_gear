import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'esm',
      },
      external: [
        // 外部依存関係を追加
      ],
    },
  },
});
