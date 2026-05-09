import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-pdf', '@react-pdf/renderer', 'tslib'],
  },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('@react-pdf')) {
            return 'pdf-report-vendor'
          }

          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
            return 'pdf-viewer-vendor'
          }

          if (id.includes('lucide-react')) {
            return 'ui-vendor'
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
