/** UC-005 — Projetar e baixar o QR Code de entrada. */
import { expect, test } from '@playwright/test'

import { entrarComoAdmin } from './apoio/admin'
import {
  abrirSessao,
  entrarNaSessao,
  limparBanco,
  semearQuiz,
} from './apoio/banco'

test.beforeEach(async ({ page }) => {
  await limparBanco()
  await entrarComoAdmin(page)
})

async function quizPronto() {
  return semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [
          { texto: 'Pergunta um', correta: 'B' },
          { texto: 'Pergunta dois', correta: 'B' },
        ],
      },
      {
        titulo: 'Avaliação formativa',
        perguntas: [{ texto: 'Pergunta três', correta: 'B' }],
      },
    ],
  })
}

test('a tela de projeção mostra o endereço por extenso, o código e o QR', async ({
  page,
}) => {
  const quiz = await quizPronto()

  await page.goto(`/admin/quizzes/${quiz.id}`)
  await page.getByRole('link', { name: 'PROJETAR QR →' }).click()

  await expect(page.getByText('APONTE A CÂMERA DO CELULAR')).toBeVisible()
  // O endereço escrito é o mesmo que o QR carrega: quem não conseguir ler o
  // código com a câmera consegue digitar.
  await expect(page.getByText(`/e/${quiz.codigo}`)).toBeVisible()
  await expect(page.locator('svg').first()).toBeVisible()
})

test('a projeção mostra o tamanho do quiz e quem já está na grade', async ({
  page,
}) => {
  const quiz = await quizPronto()
  const sessao = await abrirSessao(quiz.id)
  await entrarNaSessao(sessao.id, 'Marina')
  await entrarNaSessao(sessao.id, 'Rafael')

  await page.goto(`/admin/quizzes/${quiz.id}/qr`)

  await expect(page.getByText('SESSÃO ABERTA')).toBeVisible()

  const naGrade = page.getByRole('listitem').filter({ hasText: 'NA GRADE' })
  await expect(naGrade).toContainText('2')
  await expect(
    page.getByRole('listitem').filter({ hasText: 'ETAPAS' })
  ).toContainText('2')
  await expect(
    page.getByRole('listitem').filter({ hasText: 'PERGUNTAS' })
  ).toContainText('3')
})

test('sem sessão aberta a projeção diz que a sala ainda não abriu', async ({
  page,
}) => {
  const quiz = await quizPronto()

  await page.goto(`/admin/quizzes/${quiz.id}/qr`)

  await expect(page.getByText('AGUARDANDO SESSÃO')).toBeVisible()
})

test('a projeção não leva a barra da área administrativa para a parede', async ({
  page,
}) => {
  const quiz = await quizPronto()

  await page.goto(`/admin/quizzes/${quiz.id}/qr`)

  await expect(page.getByRole('button', { name: 'SAIR' })).toHaveCount(0)
})

test('o QR pode ser baixado como imagem nomeada pelo código', async ({
  page,
}) => {
  const quiz = await quizPronto()

  const resposta = await page.request.get(`/api/quizzes/${quiz.id}/qr`)

  expect(resposta.status()).toBe(200)
  expect(resposta.headers()['content-type']).toBe('image/png')
  expect(resposta.headers()['content-disposition']).toContain(
    `quiz-${quiz.codigo}.png`
  )

  // Assinatura do formato: os oito primeiros bytes de todo arquivo PNG.
  const bytes = await resposta.body()
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )
})
