import { criarPergunta } from '@/server/acoes'
import { exigirAdministradorNaApi } from '@/server/auth/admin'
import { responder } from '@/server/respostas'

type Contexto = { params: Promise<{ stageId: string }> }

export async function POST(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    await exigirAdministradorNaApi()
    const { stageId } = await params
    // A forma da pergunta é conferida dentro da ação: é regra do domínio, não
    // da rota, e vale igual para qualquer caminho que crie uma pergunta.
    return criarPergunta(stageId, await pedido.json().catch(() => null))
  })
}
