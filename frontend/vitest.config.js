/** Run source unit tests with browser storage and no E2E discovery. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'tests/**/*.test.jsx'],
    exclude: ['e2e/**', 'node_modules/**'],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
