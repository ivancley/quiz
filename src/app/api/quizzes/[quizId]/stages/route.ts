import { z } from 'zod'

import { criarEtapa } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ quizId: string }> }

const novaEtapa = z.object({ titulo: z.string().min(1).max(200) })

export async function POST(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { quizId } = await params
    const { titulo } = await corpo(pedido, novaEtapa)
    return criarEtapa(quizId, titulo)
  })
}
