import { z } from 'zod'

import { finalizarSessao } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ sessionId: string }> }

// É a rota por onde o organizador conduz a sessão. Hoje só a bandeirada final
// passa por aqui; a condução das etapas entra no mesmo lugar.
const conducao = z.object({ acao: z.literal('finalizar') })

export async function PATCH(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { sessionId } = await params
    await corpo(pedido, conducao)
    return finalizarSessao(sessionId)
  })
}
