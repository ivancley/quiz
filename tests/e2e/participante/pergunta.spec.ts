/** UC-011 — Responder as perguntas da etapa no celular. */
import { expect, test } from '@playwright/test'

import {
  abrirEtapaNoBanco,
  abrirSessao,
  encerrarEtapaNoBanco,
  limparBanco,
  respostasDaPergunta,
  semearQuiz,
} from '../apoio/banco'
import { desligarCelulares, entrarNaSala } from '../apoio/celular'

test.beforeEach(async () => {
  await limparBanco()
})

test.afterEach(desligarCelulares)

const ALTERNATIVAS = {
  a: 'Conteúdos obrigatórios por bimestre',
  b: 'Aprendizagens e capacidades para toda a educação básica',
  c: 'Critérios de avaliação externa',
  d: 'A lista de livros do PNLD',
}

/** Uma etapa de duas perguntas, já aberta, com uma pessoa dentro. */
async function etapaAberta(pagina: import('@playwright/test').Page) {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          {
            texto: 'O que as competências gerais descrevem?',
            correta: 'B',
            alternativas: ALTERNATIVAS,
          },
          {
            texto: 'Quem define o currículo da rede?',
            correta: 'C',
            alternativas: ALTERNATIVAS,
          },
        ],
      },
    ],
  })

  const sessao = await abrirSessao(quiz.id)
  await entrarNaSala(pagina, quiz.codigo, 'Marina')
  await abrirEtapaNoBanco(sessao.id, quiz.etapas[0].id)
  await pagina.reload()

  return { quiz, sessao }
}

test('a tela traz o enunciado, as quatro alternativas e a volta em curso', async ({
  page,
}) => {
  await etapaAberta(page)

  await expect(page.getByText('ETAPA 1 · VOLTA 1/2')).toBeVisible()
  await expect(page.getByText('0 PTS')).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'O que as competências gerais descrevem?',
    })
  ).toBeVisible()

  for (const texto of Object.values(ALTERNATIVAS)) {
    await expect(page.getByRole('button', { name: texto })).toBeVisible()
  }

  await expect(
    page.getByText(
      'Bônus para os três primeiros a acertar. A resposta é definitiva.'
    )
  ).toBeVisible()
})

test('o alvo de toque das alternativas cabe um dedo', async ({ page }) => {
  await etapaAberta(page)

  const alternativa = page.getByRole('button', { name: ALTERNATIVAS.a })
  const caixa = await alternativa.boundingBox()

  expect(caixa?.height).toBeGreaterThanOrEqual(76)
})

test('acertar mostra o retorno e leva à volta seguinte', async ({ page }) => {
  const { quiz } = await etapaAberta(page)

  await page.getByRole('button', { name: ALTERNATIVAS.b }).click()

  // Primeira a acertar: 1 ponto do acerto mais 3 de bônus de velocidade.
  await expect(page.getByText('4 PTS')).toBeVisible()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Quem define o currículo da rede?' })
  ).toBeVisible()

  const registradas = await respostasDaPergunta(quiz.etapas[0].perguntas[0].id)
  expect(registradas.map((r) => r.escolhida)).toEqual(['B'])
})

test('errar não dá ponto e a volta segue em frente', async ({ page }) => {
  await etapaAberta(page)

  await page.getByRole('button', { name: ALTERNATIVAS.d }).click()

  await expect(page.getByText('0 PTS')).toBeVisible()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()
})

test('a resposta é definitiva: o servidor recusa a segunda', async ({
  page,
}) => {
  const { quiz } = await etapaAberta(page)
  const perguntaId = quiz.etapas[0].perguntas[0].id

  await page.getByRole('button', { name: ALTERNATIVAS.b }).click()
  await expect(page.getByText('ETAPA 1 · VOLTA 2/2')).toBeVisible()

  // A tela nem oferece o caminho de volta; quem tentar por fora dela é recusado.
  const segunda = await page.request.post(`/api/e/${quiz.codigo}/responder`, {
    data: { perguntaId, escolhida: 'A' },
  })

  expect(segunda.status()).toBe(409)
  expect(await segunda.json()).toMatchObject({
    erro: 'Você já respondeu esta pergunta. A resposta é definitiva.',
  })
  expect(await respostasDaPergunta(perguntaId)).toHaveLength(1)
})

test('a etapa encerrada tira a pessoa da pergunta sem deixar responder', async ({
  page,
}) => {
  const { quiz, sessao } = await etapaAberta(page)

  // A volta acaba com a pessoa ainda decidindo. O estado foi mudado por fora da
  // aplicação, então não houve aviso nenhum — e a tela se corrige mesmo assim,
  // porque reconectar é ressincronizar.
  await encerrarEtapaNoBanco(sessao.id)

  await expect(
    page.getByRole('heading', { name: 'Aguardando a largada' })
  ).toBeVisible()

  const tardia = await page.request.post(`/api/e/${quiz.codigo}/responder`, {
    data: { perguntaId: quiz.etapas[0].perguntas[0].id, escolhida: 'B' },
  })

  expect(tardia.status()).toBe(409)
  expect(await respostasDaPergunta(quiz.etapas[0].perguntas[0].id)).toEqual([])
})
