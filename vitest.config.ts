import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/database/repositories/**/*.ts', 'src/core/**/*.ts', 'src/utils/AntiAbuse.ts', 'src/utils/BloomFilter.ts'],
      exclude: ['**/*.d.ts'],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
    testTimeout: 10_000,
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '#core': resolve(__dirname, 'src/core'),
      '#database': resolve(__dirname, 'src/database'),
      '#utils': resolve(__dirname, 'src/utils'),
      '#loaders': resolve(__dirname, 'src/loaders'),
      '#audio': resolve(__dirname, 'src/audio'),
      '#config': resolve(__dirname, 'src/config'),
    },
  },
});
