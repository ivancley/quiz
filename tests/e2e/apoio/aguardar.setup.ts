/**
 * Porta aberta não é aplicação pronta: o `next dev` faz bind antes de compilar
 * a primeira rota, e uma requisição nessa janela morre com "socket hang up".
 * Todos os projetos da bateria dependem deste passo, então nenhum spec navega
 * antes de a aplicação estar de fato respondendo.
 */
import { expect, test as preparar } from '@playwright/test'

preparar('a aplicação terminou de compilar', async ({ request }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await request.get('/')).status()
        } catch {
          // Ainda compilando: a conexão cai antes de virar resposta HTTP.
          return 0
        }
      },
      { timeout: 120_000, intervals: [500] }
    )
    // Qualquer status serve — o que importa é ter chegado uma resposta HTTP.
    // Um 5xx aqui seria aplicação subindo quebrada, e o spec de ambiente cobre isso.
    .toBeGreaterThan(0)
})
