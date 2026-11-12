import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Used by npm run test:coverage, locally and in CI
    coverage: {
      provider: 'v8',
      // Every source file counts, including ones no test imports
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**'],
      reporter: ['text-summary', 'json-summary'],
      // Floors with room under today's 98.7% statements and 97.9% branches. Never lower them
      // to get a change through.
      thresholds: {
        statements: 95,
        branches: 95,
      },
    },
  },
})
