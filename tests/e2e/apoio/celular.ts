import {
  devices,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

/**
 * O aparelho da sala. Fica aqui, e não só no `playwright.config.ts`, porque os
 * cenários com mais de um participante criam contextos à mão — e um contexto
 * criado à mão não herda o `use` do projeto. Sem isto, o segundo participante
 * abriria a tela num viewport de desktop e estaria testando outra coisa.
 */
export const CELULAR = devices['Pixel 7']

export function enderecoBase(): string {
  return (
    process.env.APP_BASE_URL ??
    `http://localhost:${process.env.APP_PORT ?? '3032'}`
  )
}

const abertos: BrowserContext[] = []

/**
 * Mais um celular na sala: contexto próprio, e portanto cookie próprio. É o que
 * separa dois participantes — compartilhar o contexto faria o segundo herdar a
 * identidade do primeiro.
 */
export async function novoCelular(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({
    ...CELULAR,
    baseURL: enderecoBase(),
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  abertos.push(contexto)
  return contexto.newPage()
}

/** Desliga os celulares extras do caso; o do fixture `page` fecha sozinho. */
export async function desligarCelulares(): Promise<void> {
  await Promise.all(abertos.splice(0).map((contexto) => contexto.close()))
}

/** O percurso da porta de entrada: abrir o endereço do QR, dizer o nome, entrar. */
export async function entrarNaSala(
  pagina: Page,
  codigo: string,
  nome: string
): Promise<void> {
  await pagina.goto(`/e/${codigo}`)
  await pagina.getByLabel('SEU NOME').fill(nome)
  await pagina.getByRole('button', { name: 'ENTRAR NA CORRIDA' }).click()
  await expect(pagina).toHaveURL(new RegExp(`/e/${codigo}/jogo$`))
}
