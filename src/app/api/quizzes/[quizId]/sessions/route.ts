import { iniciarSessao } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { responder } from '@/server/respostas'

type Contexto = { params: Promise<{ quizId: string }> }

export async function POST(_pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { quizId } = await params
    return iniciarSessao(quizId)
  })
}
