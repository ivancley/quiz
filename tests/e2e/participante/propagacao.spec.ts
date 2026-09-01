/** UC-010 — A tela do celular acompanha a sala sozinha. */
import { expect, test } from '@playwright/test'

import { conduzirSessao } from '../apoio/admin'
import { abrirSessao, limparBanco, semearQuiz } from '../apoio/banco'
import { desligarCelulares, entrarNaSala, novoCelular } from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

const ALTERNATIVA_CERTA =
  'Aprendizagens e capacidades para toda a educação básica'

async function salaAberta() {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'O que as competências gerais descrevem?', correta: 'B' },
          { texto: 'Quem define o currículo da rede?', correta: 'B' },
        ],
      },
      {
        titulo: 'Avaliação formativa',
        perguntas: [{ texto: 'Para que serve a devolutiva?', correta: 'B' }],
      },
    ],
  })

  return { quiz, sessao: await abrirSessao(quiz.id) }
}

/**
 * Uma marca que só sobrevive se a página não for recarregada — é o que separa
 * "a tela reagiu ao aviso" de "a tela foi buscar tudo de novo do zero".
 */
async function marcar(pagina: import('@playwright/test').Page) {
  await pagina.evaluate(() => {
    ;(window as unknown as { marcaDoTeste?: string }).marcaDoTeste = 'viva'
  })
}

async function marcaSobreviveu(pagina: import('@playwright/test').Page) {
  return pagina.evaluate(
    () => (window as unknown as { marcaDoTeste?: string }).marcaDoTeste
  )
}

test('abrir a etapa pelo painel muda a tela do celular sem recarregamento', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await salaAberta()
  await entrarNaSala(page, quiz.codigo, 'Marina')
  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()

  await marcar(page)

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await expect(page.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'O que as competências gerais descrevem?',
    })
  ).toBeVisible()
  expect(await marcaSobreviveu(page)).toBe('viva')
})

test('a largada chega a todos os celulares da sala ao mesmo tempo', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await salaAberta()
  await entrarNaSala(page, quiz.codigo, 'Marina')

  const outro = await novoCelular(browser)
  await entrarNaSala(outro, quiz.codigo, 'Rafael')

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await expect(page.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
  await expect(outro.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
})

test('encerrar a etapa pelo painel também chega sozinho ao celular', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await salaAberta()
  await entrarNaSala(page, quiz.codigo, 'Marina')

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })
  await expect(page.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()

  await marcar(page)
  await conduzirSessao(browser, sessao.id, { acao: 'encerrar-etapa' })

  // Ninguém respondeu nada nesta volta: não há resultado para mostrar, e a
  // pessoa volta a esperar a etapa seguinte.
  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()
  await expect(page.getByText('PREPARANDO ETAPA 2')).toBeVisible()
  expect(await marcaSobreviveu(page)).toBe('viva')
})

test('recarregar no meio da etapa devolve ao ponto exato, com a pontuação intacta', async ({
  page,
  browser,
}) => {
  const { quiz, sessao } = await salaAberta()
  await entrarNaSala(page, quiz.codigo, 'Marina')

  await conduzirSessao(browser, sessao.id, {
    acao: 'abrir-etapa',
    etapaId: quiz.etapas[0].id,
  })

  await page.getByRole('button', { name: ALTERNATIVA_CERTA }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await expect(page.getByText('4 PTS')).toBeVisible()

  // O gesto de quem achou que travou. Não pode custar nada.
  await page.reload()

  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await expect(page.getByText('4 PTS')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Quem define o currículo da rede?' })
  ).toBeVisible()
})
