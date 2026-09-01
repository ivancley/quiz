/** UC-001 — Entrar e sair da área do organizador. */
import { expect, test } from '@playwright/test'

import { alertaComTexto } from './apoio/pagina'
import { ADMIN, limparBanco } from './apoio/banco'

test.beforeEach(async () => {
  await limparBanco()
})

test('a área do organizador não abre sem credencial', async ({ page }) => {
  await page.goto('/admin')

  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Área do organizador' })
  ).toBeVisible()
})

test('a credencial errada é recusada sem dizer o que errou', async ({
  page,
}) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-MAIL').fill(ADMIN.email)
  await page.getByLabel('SENHA').fill('senha-que-nao-e-a-dele')
  await page.getByRole('button', { name: 'ENTRAR' }).click()

  // O Next.js injeta um anunciador de rota que também tem papel de alerta e
  // vive vazio; o alerta que interessa é o que traz texto.
  await expect(alertaComTexto(page)).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('a credencial correta abre a área e sair fecha de novo', async ({
  page,
}) => {
  await page.goto('/admin/login')
  await page.getByLabel('E-MAIL').fill(ADMIN.email)
  await page.getByLabel('SENHA').fill(ADMIN.senha)
  await page.getByRole('button', { name: 'ENTRAR' }).click()

  await expect(
    page.getByRole('heading', { name: 'Seus quizzes' })
  ).toBeVisible()
  await expect(page.getByText(ADMIN.email)).toBeVisible()

  await page.getByRole('button', { name: 'SAIR' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)

  // Voltar para a área protegida depois de sair cai no login de novo: o cookie
  // foi de fato invalidado, não só a tela trocada.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})
