import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.', // Define a raiz como a pasta atual (frontend)
  build: {
    outDir: 'dist', // Pasta de saída
    emptyOutDir: true, // Limpa a pasta dist antes de construir
    rollupOptions: {
      input: {
        // Ponto de entrada 1: Admin
        main: resolve(__dirname, 'index.html'),
        // Ponto de entrada 2: Portal do Aluno
        aluno: resolve(__dirname, 'aluno/index.html')
      }
    }
  }
})