/** UC-006 — Abrir e encerrar a sessão de um quiz. */
import { expect, test, type Page } from '@playwright/test'

import { confirmarDialogos, entrarComoAdmin } from './apoio/admin'
import { entrarNaSessao, limparBanco, semearQuiz } from './apoio/banco'

test.beforeEach(async ({ page }) => {
  await limparBanco()
  confirmarDialogos(page)
  await entrarComoAdmin(page)
})

async function quizPronto(page: Page) {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [{ texto: 'Pergunta um', correta: 'B' }],
      },
    ],
  })
  await page.goto(`/admin/quizzes/${quiz.id}`)
  return quiz
}

test('iniciar a sessão põe o quiz na largada', async ({ page }) => {
  await quizPronto(page)

  await page.getByRole('button', { name: 'INICIAR SESSÃO' }).click()

  await expect(page.getByText('● NA LARGADA')).toBeVisible()
  await expect(page.getByRole('link', { name: 'ABRIR PAINEL →' })).toBeVisible()
})

test('com a sessão no ar não há como abrir uma segunda', async ({ page }) => {
  await quizPronto(page)
  await page.getByRole('button', { name: 'INICIAR SESSÃO' }).click()
  await expect(page.getByText('● NA LARGADA')).toBeVisible()

  await expect(
    page.getByRole('button', { name: 'INICIAR SESSÃO' })
  ).toHaveCount(0)
})

test('o conteúdo do quiz congela enquanto a sessão está no ar', async ({
  page,
}) => {
  await quizPronto(page)
  await page.getByRole('button', { name: 'INICIAR SESSÃO' }).click()

  await expect(page.getByText(/O conteúdo está congelado/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'ADICIONAR' })).toBeDisabled()

  const etapa = page.getByRole('listitem').filter({ hasText: 'PERGUNTA' })
  await expect(etapa.getByRole('button', { name: 'RENOMEAR' })).toBeDisabled()
  await expect(etapa.getByRole('button', { name: 'EXCLUIR' })).toBeDisabled()
})

test('o servidor recusa a edição mesmo por fora da tela', async ({ page }) => {
  const quiz = await quizPronto(page)
  await page.getByRole('button', { name: 'INICIAR SESSÃO' }).click()
  await expect(page.getByText('● NA LARGADA')).toBeVisible()

  // A trava da tela é conveniência; a regra tem de valer para quem chama a rota
  // direto, que é o que aconteceria com uma aba antiga ainda aberta.
  const resposta = await page.request.patch(
    `/api/stages/${quiz.etapas[0].id}`,
    { data: { titulo: 'Tentando mexer' } }
  )

  expect(resposta.status()).toBe(409)
  expect(await resposta.json()).toMatchObject({
    erro: expect.stringContaining('sessão em andamento'),
  })
})

test('encerrar a sessão libera o conteúdo e guarda a corrida no histórico', async ({
  page,
}) => {
  const quiz = await quizPronto(page)
  await page.getByRole('button', { name: 'INICIAR SESSÃO' }).click()
  await expect(page.getByText('● NA LARGADA')).toBeVisible()

  await page.getByRole('button', { name: 'ENCERRAR SESSÃO' }).click()

  await expect(page.getByText('ENCERRADA')).toBeVisible()
  await expect(page.getByText(/O conteúdo está congelado/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'ADICIONAR' })).toBeEnabled()

  // E a próxima turma já pode correr o mesmo quiz.
  await expect(
    page.getByRole('button', { name: 'INICIAR SESSÃO' })
  ).toBeEnabled()

  await page.goto(`/admin/quizzes/${quiz.id}`)
  await expect(page.getByRole('link', { name: 'VER PLACAR →' })).toBeVisible()
})

test('a sessão mostra quanta gente já está na grade', async ({ page }) => {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [
      {
        titulo: 'Currículo em ação',
        perguntas: [{ texto: 'Pergunta um', correta: 'B' }],
      },
    ],
  })

  const resposta = await page.request.post(`/api/quizzes/${quiz.id}/sessions`)
  const { dados } = await resposta.json()
  await entrarNaSessao(dados.id, 'Marina')
  await entrarNaSessao(dados.id, 'Rafael')

  await page.goto(`/admin/quizzes/${quiz.id}`)

  await expect(page.getByText('2 pessoas na grade')).toBeVisible()
})
