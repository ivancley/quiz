import { expect, type Browser, type Page } from '@playwright/test'

import { ADMIN } from './banco'
import { enderecoBase } from './celular'

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

/**
 * As ações destrutivas passam por uma confirmação do navegador, e o Playwright
 * dispensa qualquer diálogo por padrão — sem isto, o clique em EXCLUIR seria
 * silenciosamente cancelado e o teste passaria sem ter excluído nada.
 */
export function confirmarDialogos(pagina: Page) {
  pagina.on('dialog', (dialogo) => dialogo.accept())
}

/**
 * Conduz a sessão pela rota do organizador, de um contexto próprio.
 *
 * Ir pela rota, e não mexendo direto no banco, é o que faz o aviso de tempo
 * real sair do processo da aplicação — é a diferença entre medir a propagação
 * e medir o recarregamento da página.
 */
export async function conduzirSessao(
  browser: Browser,
  sessaoId: string,
  acao: Record<string, string>
): Promise<void> {
  const contexto = await browser.newContext({ baseURL: enderecoBase() })

  try {
    const entrada = await contexto.request.post('/api/admin/login', {
      data: { email: ADMIN.email, senha: ADMIN.senha },
    })
    expect(entrada.ok()).toBe(true)

    const conduzida = await contexto.request.patch(
      `/api/sessions/${sessaoId}`,
      { data: acao }
    )
    expect(conduzida.ok()).toBe(true)
  } finally {
    await contexto.close()
  }
}
