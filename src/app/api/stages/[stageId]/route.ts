import { z } from 'zod'

import { excluirEtapa, moverEtapa, renomearEtapa } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ stageId: string }> }

// Renomear e mudar de lugar são a mesma requisição para a tela — as duas ações
// saem de um botão na linha da etapa — mas nunca acontecem juntas.
const alteracao = z.union([
  z.object({ titulo: z.string().min(1).max(200) }),
  z.object({ mover: z.enum(['cima', 'baixo']) }),
])

export async function PATCH(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { stageId } = await params
    const pedidoDeAlteracao = await corpo(pedido, alteracao)

    return 'mover' in pedidoDeAlteracao
      ? moverEtapa(stageId, pedidoDeAlteracao.mover)
      : renomearEtapa(stageId, pedidoDeAlteracao.titulo)
  })
}

export async function DELETE(_pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { stageId } = await params
    return excluirEtapa(stageId)
  })
}
