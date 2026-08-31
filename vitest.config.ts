import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: '.env.test', quiet: true })

export default defineConfig({
  test: {
    // As regras críticas do domínio vivem em constraints do Postgres, então os
    // testes rodam contra um banco real. Um só processo evita que duas suítes
    // limpem as tabelas uma da outra.
    pool: 'forks',
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
})
