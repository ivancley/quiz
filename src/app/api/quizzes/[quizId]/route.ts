import { z } from 'zod'

import { excluirQuiz, renomearQuiz } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ quizId: string }> }

const alteracao = z.object({ titulo: z.string().min(1).max(200) })

export async function PATCH(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { quizId } = await params
    const { titulo } = await corpo(pedido, alteracao)
    return renomearQuiz(quizId, titulo)
  })
}

export async function DELETE(_pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { quizId } = await params
    return excluirQuiz(quizId)
  })
}
