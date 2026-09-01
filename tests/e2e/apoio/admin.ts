import { expect, type Page } from '@playwright/test'

import { ADMIN } from './banco'

/** Deixa o contexto do navegador com o cookie de organizador já emitido. */
export async function entrarComoAdmin(pagina: Page) {
  await pagina.goto('/admin/login')
  await pagina.getByLabel('E-MAIL').fill(ADMIN.email)
  await pagina.getByLabel('SENHA').fill(ADMIN.senha)
  await pagina.getByRole('button', { name: 'ENTRAR' }).click()

  await expect(
    pagina.getByRole('heading', { name: 'Seus quizzes' })
  ).toBeVisible()
}
