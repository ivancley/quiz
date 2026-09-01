import next from 'eslint-config-next'

const configuracao = [
  {
    ignores: [
      '.next/**',
      '.next-e2e/**',
      'node_modules/**',
      'drizzle/**',
      'next-env.d.ts',
      // Saída da bateria: relatório e traces são artefatos, não código do projeto.
      'playwright-report/**',
      'test-results/**',
    ],
  },
  // O pacote já exporta a lista no formato flat; não é uma fábrica.
  ...next,
]

export default configuracao
