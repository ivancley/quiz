import { z } from 'zod'

import { abrirEtapa, encerrarEtapa, finalizarSessao } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ sessionId: string }> }

// É por aqui que o organizador conduz a dinâmica inteira: abre a etapa, encerra
// a etapa e dá a bandeirada final.
const conducao = z.union([
  z.object({ acao: z.literal('abrir-etapa'), etapaId: z.uuid() }),
  z.object({ acao: z.literal('encerrar-etapa') }),
  z.object({ acao: z.literal('finalizar') }),
])

export async function PATCH(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { sessionId } = await params
    const pedidoDeConducao = await corpo(pedido, conducao)

    if (pedidoDeConducao.acao === 'abrir-etapa') {
      return abrirEtapa(sessionId, pedidoDeConducao.etapaId)
    }
    if (pedidoDeConducao.acao === 'encerrar-etapa') {
      return encerrarEtapa(sessionId)
    }
    return finalizarSessao(sessionId)
  })
}
