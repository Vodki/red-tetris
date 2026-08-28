import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The Tailwind PostCSS pipeline is a Next.js build concern; the tests only
  // need the CSS imports to resolve, not to be compiled.
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'istanbul',
      all: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/tests/**',
        'src/app/layout.js',
        'src/assets/**',
        '**/*.config.*',
      ],
      // Subject: at least 70% of statements, functions and lines, 50% of branches.
      thresholds: {
        statements: 70,
        functions: 70,
        lines: 70,
        branches: 50,
      },
    },
  },
});
