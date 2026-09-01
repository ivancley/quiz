import { migrarBanco } from '@/server/migracao'

import { verificarAmbiente } from '@/server/ambiente'

/**
 * Roda uma vez, quando o servidor sobe, antes de atender qualquer requisição.
 * É onde uma configuração incompleta precisa aparecer: descobrir que falta a
 * chave de assinatura quando o administrador tenta entrar significa descobrir
 * com a sala já sentada.
 */
export async function register() {
  verificarAmbiente()

  // Só o contêiner liga isto. Em desenvolvimento as migrações são aplicadas à
  // mão, e exigir banco de pé para abrir o servidor atrapalharia mais do que
  // ajudaria; no contêiner, servir uma aplicação sobre um banco desatualizado é
  // que seria o problema.
  if (process.env.MIGRAR_NO_START === '1') {
    await migrarBanco()
  }
}
