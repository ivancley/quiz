import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.e2e', quiet: true })

const porta = process.env.APP_PORT ?? '3032'
const enderecoBase = process.env.APP_BASE_URL ?? `http://localhost:${porta}`

export default defineConfig({
  testDir: './tests/e2e',
  // O Vitest cuida de tests/**/*.test.ts; a separação por extensão evita que
  // uma suíte tente rodar os casos da outra.
  testMatch: '**/*.spec.ts',

  // Os cenários compartilham um único banco e uma única sessão de quiz ativa
  // (RF-036), então dois arquivos em paralelo disputariam o mesmo estado.
  workers: 1,
  fullyParallel: false,

  // Um teste ponta a ponta daqui abre vários navegadores e espera propagação
  // por SSE; o padrão de 30s é apertado para a sessão completa do CS-001.
  timeout: 90_000,
  expect: { timeout: 10_000 },

  // Repetir um teste que falhou esconderia justamente a classe de defeito que
  // mais importa aqui: corrida entre respostas e evento de tempo real.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/resultados.json' }],
  ],

  use: {
    baseURL: enderecoBase,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'preparar',
      testMatch: '**/apoio/*.setup.ts',
      teardown: 'encerrar',
    },
    {
      name: 'encerrar',
      testMatch: '**/apoio/*.teardown.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['preparar'],
    },
    {
      // A tela do participante é desenhada para celular em retrato (RF-031);
      // validar os fluxos móveis num viewport de desktop testaria outra coisa.
      name: 'celular',
      use: { ...devices['Pixel 7'] },
      testMatch: '**/participante/*.spec.ts',
      dependencies: ['preparar'],
    },
  ],

  webServer: {
    // Build de produção, e não `next dev`, por dois motivos. O hub de SSE vive
    // num Map em memória e o HMR recarrega o módulo, derrubando os inscritos —
    // testar tempo real contra o servidor de desenvolvimento mediria o
    // recarregamento, não o produto. E o watcher de arquivos de um segundo
    // `next dev` estoura o limite de descritores desta máquina quando o do dia
    // a dia já está no ar.
    command: 'npm run e2e:servidor',
    // Prontidão pela porta, e não por uma URL: a checagem por URL exige
    // resposta abaixo de 400, e a raiz redireciona para telas que ainda estão
    // sendo construídas.
    port: Number(porta),
    // O banco é recriado antes de subir a aplicação; reaproveitar um servidor
    // que já estava de pé o deixaria com um pool apontando para o banco antigo.
    reuseExistingServer: false,
    // Inclui o `next build` da bateria, não só a subida do servidor.
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Diretório de build separado: sem isso, este servidor e o `next dev`
      // aberto na porta 3031 apagam o `.next` um do outro.
      NEXT_DIST_DIR: '.next-e2e',
      APP_PORT: porta,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      APP_BASE_URL: enderecoBase,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH ?? '',
      AUTH_SECRET: process.env.AUTH_SECRET ?? '',
    },
  },
})
