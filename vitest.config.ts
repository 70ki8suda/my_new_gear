import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.git', 'dist'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'dist/', 'coverage/'],
    },
    globals: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
