import type { Locator, Page } from '@playwright/test'

/**
 * O alerta visível da tela.
 *
 * O Next.js injeta um anunciador de rota que também tem papel de alerta e vive
 * vazio, então buscar o papel sozinho encontra sempre dois elementos. O que
 * interessa é o que tem texto.
 */
export function alertaComTexto(pagina: Page): Locator {
  return pagina.getByRole('alert').filter({ hasText: /\S/ })
}
