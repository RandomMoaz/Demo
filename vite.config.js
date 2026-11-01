import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  test: { environment: 'node', include: ['tests/**/*.test.{js,jsx}'], setupFiles: ['tests/setup.js'] },
})
