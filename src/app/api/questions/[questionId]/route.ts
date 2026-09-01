import { alterarPergunta, excluirPergunta, moverPergunta } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { responder } from '@/server/respostas'

type Contexto = { params: Promise<{ questionId: string }> }

export async function PATCH(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { questionId } = await params
    const enviado = await pedido.json().catch(() => null)

    // Mudar de lugar é o único pedido que não traz o conteúdo da pergunta; tudo
    // o mais é uma reescrita completa dela.
    if (enviado?.mover === 'cima' || enviado?.mover === 'baixo') {
      return moverPergunta(questionId, enviado.mover)
    }

    return alterarPergunta(questionId, enviado)
  })
}

export async function DELETE(_pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { questionId } = await params
    return excluirPergunta(questionId)
  })
}
