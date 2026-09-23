/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only the production build is served as a GitHub Pages project site
  // (chungchiyu.github.io/openMotor-online/), so only it needs the repo name as a base path —
  // the dev server still runs at the domain root.
  base: command === 'build' ? '/openMotor-online/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}))
