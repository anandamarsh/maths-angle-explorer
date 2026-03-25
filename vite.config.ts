import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/maths-angle-explorer/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 4002,
    strictPort: true,
  },
}))
