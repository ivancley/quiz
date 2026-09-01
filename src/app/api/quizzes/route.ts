import { z } from 'zod'

import { criarQuiz } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { corpo, responder } from '@/server/respostas'

const novoQuiz = z.object({ titulo: z.string().min(1).max(200) })

export async function POST(pedido: Request) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { titulo } = await corpo(pedido, novoQuiz)
    return criarQuiz(titulo)
  })
}
