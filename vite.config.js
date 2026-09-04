import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // exceljs no se lista acá: entra por import dinámico y Vite le arma su
    // propio archivo, que solo se descarga al exportar a Excel.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
