import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

// Node.jsの組み込みモジュール + モジュール名に/を含むパッケージを外部依存として扱う
const external = [...builtinModules, ...builtinModules.map((m) => `node:${m}`), /^@hono\/.*/, /^drizzle-.*/];

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
      external,
    },
  },
});
