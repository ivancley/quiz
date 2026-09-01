/** UC-003 — Montar e ordenar as etapas de um quiz. */
import { expect, test, type Page } from '@playwright/test'

import { confirmarDialogos, entrarComoAdmin } from './apoio/admin'
import { limparBanco, semearQuiz } from './apoio/banco'

test.beforeEach(async ({ page }) => {
  await limparBanco()
  confirmarDialogos(page)
  await entrarComoAdmin(page)
})

/** Um quiz sem etapa nenhuma, para as etapas nascerem pela tela. */
async function quizVazio(page: Page) {
  const quiz = await semearQuiz({
    titulo: 'Formação de Professores',
    etapas: [],
  })
  await page.goto(`/admin/quizzes/${quiz.id}`)
  return quiz
}

/** Os títulos das etapas na ordem em que a tela as apresenta. */
function etapasNaTela(page: Page) {
  return page.getByRole('listitem').filter({ hasText: /PERGUNTA/ })
}

async function adicionar(page: Page, titulo: string) {
  const campo = page.getByLabel('NOVA ETAPA')
  await campo.fill(titulo)
  await page.getByRole('button', { name: 'ADICIONAR' }).click()

  await expect(page.getByText(titulo)).toBeVisible()
  // A linha nova aparece um instante antes de o campo se esvaziar. Digitar
  // nesse intervalo perderia o texto seguinte, então a próxima etapa só entra
  // depois que a anterior terminou de assentar.
  await expect(campo).toHaveValue('')
}

test('as etapas entram na fila, uma depois da outra', async ({ page }) => {
  await quizVazio(page)
  await expect(page.getByText(/Nenhuma etapa ainda/)).toBeVisible()

  await adicionar(page, 'Currículo em ação')
  await adicionar(page, 'Avaliação formativa')
  await adicionar(page, 'Gestão de sala')

  const etapas = etapasNaTela(page)
  await expect(etapas).toHaveCount(3)
  await expect(etapas.nth(0)).toContainText('01')
  await expect(etapas.nth(0)).toContainText('Currículo em ação')
  await expect(etapas.nth(2)).toContainText('03')
  await expect(etapas.nth(2)).toContainText('Gestão de sala')
})

test('a etapa sobe de posição e a ordem persiste ao recarregar', async ({
  page,
}) => {
  const quiz = await quizVazio(page)
  await adicionar(page, 'Primeira')
  await adicionar(page, 'Segunda')
  await adicionar(page, 'Terceira')

  await page.getByRole('button', { name: 'Subir a etapa Terceira' }).click()
  await expect(etapasNaTela(page).nth(1)).toContainText('Terceira')

  await page.goto(`/admin/quizzes/${quiz.id}`)

  const etapas = etapasNaTela(page)
  await expect(etapas.nth(0)).toContainText('Primeira')
  await expect(etapas.nth(1)).toContainText('Terceira')
  await expect(etapas.nth(2)).toContainText('Segunda')
})

test('a primeira etapa não sobe e a última não desce', async ({ page }) => {
  await quizVazio(page)
  await adicionar(page, 'Primeira')
  await adicionar(page, 'Segunda')

  await expect(
    page.getByRole('button', { name: 'Subir a etapa Primeira' })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Descer a etapa Segunda' })
  ).toBeDisabled()
})

test('renomear a etapa não muda o lugar dela', async ({ page }) => {
  await quizVazio(page)
  await adicionar(page, 'Primeira')
  await adicionar(page, 'Nome errado')

  await etapasNaTela(page)
    .nth(1)
    .getByRole('button', { name: 'RENOMEAR' })
    .click()

  // Em edição a linha troca a contagem de perguntas pelo campo de texto, então
  // deixa de casar com o filtro das linhas em repouso.
  const emEdicao = page.getByRole('listitem').filter({ hasText: 'SALVAR' })
  await emEdicao.getByRole('textbox').fill('Avaliação formativa')
  await emEdicao.getByRole('button', { name: 'SALVAR' }).click()

  const etapas = etapasNaTela(page)
  await expect(etapas.nth(1)).toContainText('02')
  await expect(etapas.nth(1)).toContainText('Avaliação formativa')
})

test('excluir uma etapa do meio fecha o buraco na numeração', async ({
  page,
}) => {
  await quizVazio(page)
  await adicionar(page, 'Primeira')
  await adicionar(page, 'Segunda')
  await adicionar(page, 'Terceira')

  await etapasNaTela(page)
    .nth(1)
    .getByRole('button', { name: 'EXCLUIR' })
    .click()

  const etapas = etapasNaTela(page)
  await expect(etapas).toHaveCount(2)
  await expect(etapas.nth(0)).toContainText('01')
  await expect(etapas.nth(0)).toContainText('Primeira')
  await expect(etapas.nth(1)).toContainText('02')
  await expect(etapas.nth(1)).toContainText('Terceira')
})
