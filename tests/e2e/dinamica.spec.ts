/**
 * UC-014 — A dinâmica inteira, do cadastro à bandeirada.
 *
 * É o único cenário que se parece com o dia do evento: quatro navegadores ao
 * mesmo tempo, um conduzindo e três correndo, com o quiz nascendo pela tela do
 * organizador e ninguém recarregando página nenhuma.
 */
import { expect, test, type Page } from '@playwright/test'

import { entrarComoAdmin } from './apoio/admin'
import { limparBanco } from './apoio/banco'
import { desligarCelulares, entrarNaSala, novoCelular } from './apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

/** O limite acordado para a sala inteira virar de tela, em milissegundos. */
const LIMITE_DE_PROPAGACAO = 2000

const ALTERNATIVAS = {
  A: 'Conteúdos obrigatórios por bimestre',
  B: 'Aprendizagens e capacidades para toda a educação básica',
  C: 'Critérios de avaliação externa',
  D: 'A lista de livros do PNLD',
}

const ROTEIRO = [
  {
    etapa: 'Currículo em ação',
    perguntas: [
      { texto: 'O que as competências gerais descrevem?', correta: 'B' },
      { texto: 'Quem define o currículo da rede?', correta: 'B' },
    ],
  },
  {
    etapa: 'Avaliação formativa',
    perguntas: [{ texto: 'Para que serve a devolutiva?', correta: 'B' }],
  },
] as const

/** Monta o quiz inteiro pela área do organizador, como no dia anterior ao evento. */
async function montarQuizPelaTela(painel: Page): Promise<string> {
  await painel.getByLabel('NOVO QUIZ').fill('Formação de Professores')
  await painel.getByRole('button', { name: 'CRIAR' }).click()
  await painel.getByRole('link', { name: /Formação de Professores/ }).click()

  for (const { etapa } of ROTEIRO) {
    const campo = painel.getByLabel('NOVA ETAPA')
    await campo.fill(etapa)
    await painel.getByRole('button', { name: 'ADICIONAR' }).click()
    await expect(campo).toHaveValue('')
  }

  for (const { etapa, perguntas } of ROTEIRO) {
    await painel.getByRole('link', { name: new RegExp(etapa) }).click()

    for (const pergunta of perguntas) {
      await painel.getByRole('button', { name: 'NOVA PERGUNTA' }).click()
      await painel.getByLabel('ENUNCIADO').fill(pergunta.texto)
      for (const [letra, texto] of Object.entries(ALTERNATIVAS)) {
        await painel.getByPlaceholder(`Alternativa ${letra}`).fill(texto)
      }
      await painel
        .getByRole('radio', {
          name: `Marcar a alternativa ${pergunta.correta} como correta`,
        })
        .check()
      await painel.getByRole('button', { name: 'ADICIONAR' }).click()
      await expect(painel.getByText(pergunta.texto)).toBeVisible()
    }

    await painel
      .getByRole('link', { name: '← Formação de Professores' })
      .click()

    // Clicar num link devolve o controle antes de a navegação terminar. Sem
    // esperar a página do quiz aparecer, o passo seguinte ainda enxerga a tela
    // da etapa — e lê dela o que deveria ler daqui.
    await expect(painel.getByRole('heading', { name: 'SESSÕES' })).toBeVisible()
  }

  // O código impresso no QR é o endereço da sala. Vem com a indentação do
  // markup em volta, e ela não pode ir junto para dentro da URL.
  const codigo = (
    await painel
      .getByText(/^[A-Z2-9]{6}$/)
      .first()
      .textContent()
  )?.trim()

  expect(codigo).toMatch(/^[A-Z2-9]{6}$/)
  return codigo as string
}

test('uma sessão inteira roda com quatro navegadores ao mesmo tempo', async ({
  page: painel,
  browser,
}) => {
  await entrarComoAdmin(painel)
  const codigo = await montarQuizPelaTela(painel)

  await painel.getByRole('button', { name: 'INICIAR SESSÃO' }).click()
  await expect(
    painel.getByRole('link', { name: 'ABRIR PAINEL →' })
  ).toBeVisible()

  // Três celulares escaneiam o QR e entram, um depois do outro.
  const [daMarina, doRafael, daJuliana] = await Promise.all([
    novoCelular(browser),
    novoCelular(browser),
    novoCelular(browser),
  ])
  await entrarNaSala(daMarina, codigo, 'Marina')
  await entrarNaSala(doRafael, codigo, 'Rafael')
  await entrarNaSala(daJuliana, codigo, 'Juliana')

  await painel.getByRole('link', { name: 'ABRIR PAINEL →' }).click()
  await expect(painel.getByText('NA GRADE · 3')).toBeVisible()

  // ---- Primeira etapa ----

  const largada = Date.now()
  await painel.getByRole('button', { name: 'INICIAR ETAPA 1' }).click()

  // O último celular da fila é o que mede o pior caso da propagação.
  await expect(daJuliana.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
  const propagacao = Date.now() - largada
  expect(propagacao).toBeLessThan(LIMITE_DE_PROPAGACAO)

  await expect(daMarina.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
  await expect(doRafael.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()

  // Marina acerta primeiro; Rafael em seguida; Juliana erra.
  const primeiraResposta = Date.now()
  await daMarina.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await expect(painel.getByText('4 PTS')).toBeVisible()
  const ecoNoPainel = Date.now() - primeiraResposta
  expect(ecoNoPainel).toBeLessThan(LIMITE_DE_PROPAGACAO)

  await doRafael.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await daJuliana.getByRole('button', { name: ALTERNATIVAS.D }).click()

  for (const celular of [daMarina, doRafael, daJuliana]) {
    await expect(celular.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  }

  // No meio da volta, um celular recarrega — o gesto de quem achou que travou.
  await daMarina.reload()
  await expect(daMarina.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await expect(daMarina.getByText('4 PTS')).toBeVisible()

  // Segunda pergunta: Juliana acerta primeiro, Marina depois, Rafael erra.
  await daJuliana.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await expect(daJuliana.getByText('PONTOS DESTA ETAPA')).toBeVisible()
  await daMarina.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await doRafael.getByRole('button', { name: ALTERNATIVAS.C }).click()

  // Todo mundo respondeu tudo: a etapa fecha sozinha.
  await expect(painel.getByText('NENHUMA ETAPA ABERTA')).toBeVisible()
  for (const celular of [daMarina, doRafael, daJuliana]) {
    await expect(celular.getByText('ETAPA 1 ENCERRADA')).toBeVisible()
  }

  // ---- Segunda etapa ----

  await painel.getByRole('button', { name: 'INICIAR ETAPA 2' }).click()
  for (const celular of [daMarina, doRafael, daJuliana]) {
    await expect(celular.getByText('ETAPA 2 · VOLTA 1/1')).toBeVisible()
  }

  await doRafael.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await daMarina.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await daJuliana.getByRole('button', { name: ALTERNATIVAS.B }).click()

  await expect(painel.getByText('NENHUMA ETAPA ABERTA')).toBeVisible()

  // ---- Bandeirada ----

  painel.on('dialog', (dialogo) => dialogo.accept())
  await painel.getByRole('button', { name: 'BANDEIRADA FINAL' }).click()
  await expect(painel.getByText('● ENCERRADA')).toBeVisible()

  for (const celular of [daMarina, doRafael, daJuliana]) {
    await expect(celular.getByText('BANDEIRADA FINAL')).toBeVisible()
  }

  /*
   * O placar conferido à mão.
   *
   * Etapa 1, pergunta 1: Marina acerta em 1º (1+3=4), Rafael em 2º (1+2=3),
   * Juliana erra (0).
   * Etapa 1, pergunta 2: Juliana acerta em 1º (4), Marina em 2º (3),
   * Rafael erra (0).
   * Etapa 2: Rafael acerta em 1º (4), Marina em 2º (3), Juliana em 3º (2).
   *
   * Marina 4+3+3 = 10 · Rafael 3+0+4 = 7 · Juliana 0+4+2 = 6.
   */
  await painel.getByRole('link', { name: 'Ver o placar final →' }).click()

  // A primeira linha da tabela é o cabeçalho; a classificação vem depois dela.
  const linhas = painel.getByRole('row')
  await expect(linhas.nth(1)).toContainText('Marina')
  await expect(linhas.nth(1)).toContainText('10')
  await expect(linhas.nth(2)).toContainText('Rafael')
  await expect(linhas.nth(2)).toContainText('7')
  await expect(linhas.nth(3)).toContainText('Juliana')
  await expect(linhas.nth(3)).toContainText('6')

  await expect(daMarina.getByText('1º')).toBeVisible()
  await expect(doRafael.getByText('2º')).toBeVisible()
  await expect(daJuliana.getByText('3º')).toBeVisible()
})

test('as telas do celular cabem em retrato, sem rolagem lateral', async ({
  page: painel,
  browser,
}) => {
  await entrarComoAdmin(painel)
  const codigo = await montarQuizPelaTela(painel)
  await painel.getByRole('button', { name: 'INICIAR SESSÃO' }).click()
  await expect(
    painel.getByRole('link', { name: 'ABRIR PAINEL →' })
  ).toBeVisible()

  const celular = await novoCelular(browser)

  /** Nenhuma tela do celular pode empurrar conteúdo para fora da largura. */
  async function conferirLargura(marca: string) {
    await expect(celular.getByText(marca)).toBeVisible()
    const sobra = await celular.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
    expect(sobra, `rolagem lateral em "${marca}"`).toBeLessThanOrEqual(0)
  }

  await celular.goto(`/e/${codigo}`)
  await conferirLargura('SEU KART')

  await entrarNaSala(celular, codigo, 'Marina')
  await conferirLargura('KART 01 · NA GRADE')

  await painel.getByRole('link', { name: 'ABRIR PAINEL →' }).click()
  await painel.getByRole('button', { name: 'INICIAR ETAPA 1' }).click()
  await conferirLargura('ETAPA 1 · VOLTA 1/2')

  // O alvo de toque das alternativas é o que decide se dá para jogar de pé.
  for (const texto of Object.values(ALTERNATIVAS)) {
    const caixa = await celular
      .getByRole('button', { name: texto })
      .boundingBox()
    expect(caixa?.height, `alvo de toque de "${texto}"`).toBeGreaterThanOrEqual(
      76
    )
  }

  await celular.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await expect(celular.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await celular.getByRole('button', { name: ALTERNATIVAS.B }).click()
  await conferirLargura('PONTOS DESTA ETAPA')
})
