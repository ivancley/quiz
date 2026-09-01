/** UC-002 — Criar, renomear e excluir um quiz. */
import { expect, test } from '@playwright/test'

import { confirmarDialogos, entrarComoAdmin } from './apoio/admin'
import { limparBanco } from './apoio/banco'

test.beforeEach(async ({ page }) => {
  await limparBanco()
  confirmarDialogos(page)
  await entrarComoAdmin(page)
})

test('um quiz novo nasce com código de entrada e sem etapas', async ({
  page,
}) => {
  await page.getByLabel('NOVO QUIZ').fill('Formação de Professores')
  await page.getByRole('button', { name: 'CRIAR' }).click()

  const cartao = page.getByRole('listitem').filter({ hasText: 'ETAPAS' })
  await expect(cartao).toHaveCount(1)
  await expect(cartao).toContainText('Formação de Professores')
  await expect(cartao).toContainText('0 ETAPAS · 0 PERGUNTAS')

  // O código é sorteado e vai impresso no QR; o que se afirma é a forma.
  await expect(cartao.getByText(/^[A-Z2-9]{6}$/)).toBeVisible()
})

test('a lista vazia explica o que fazer', async ({ page }) => {
  await expect(page.getByText(/Nenhum quiz ainda/)).toBeVisible()
})

test('renomear o quiz preserva o código de entrada', async ({ page }) => {
  await page.getByLabel('NOVO QUIZ').fill('Nome provisório')
  await page.getByRole('button', { name: 'CRIAR' }).click()

  await page.getByRole('link', { name: /Nome provisório/ }).click()

  const codigo = await page
    .getByText(/^[A-Z2-9]{6}$/)
    .first()
    .textContent()

  await page.getByRole('button', { name: 'RENOMEAR' }).click()
  await page.getByRole('textbox').first().fill('BNCC na prática')
  await page.getByRole('button', { name: 'SALVAR' }).click()

  await expect(
    page.getByRole('heading', { name: 'BNCC na prática' })
  ).toBeVisible()
  await expect(page.getByText(codigo as string)).toBeVisible()
})

test('excluir o quiz tira ele da lista', async ({ page }) => {
  await page.getByLabel('NOVO QUIZ').fill('Descartável')
  await page.getByRole('button', { name: 'CRIAR' }).click()
  await expect(page.getByText('Descartável')).toBeVisible()

  await page.getByRole('button', { name: 'EXCLUIR' }).click()

  await expect(page.getByText('Descartável')).toHaveCount(0)
  await expect(page.getByText(/Nenhum quiz ainda/)).toBeVisible()
})
