import { z } from 'zod'

import { registrarResposta } from '@/server/acoes'
import { identidadeAtual } from '@/server/auth/participante'
import { RecusaDeRegra } from '@/server/db/erros'
import { LETRAS } from '@/server/db/schema'
import { corpo, responder } from '@/server/respostas'

// Quem responde é sempre quem o cookie diz que é. A pergunta vem no corpo; a
// etapa a que ela pertence e a validade do momento são conferidas no servidor.
const envio = z.object({
  perguntaId: z.uuid(),
  escolhida: z.enum(LETRAS),
})

export async function POST(pedido: Request) {
  return responder(async () => {
    const identidade = await identidadeAtual()
    if (!identidade) {
      throw new RecusaDeRegra('Entre na corrida para responder.', 401)
    }

    const { perguntaId, escolhida } = await corpo(pedido, envio)
    return registrarResposta(identidade, perguntaId, escolhida)
  })
}
