import { cookies } from 'next/headers'
import { z } from 'zod'

import { entrarNaCorrida } from '@/server/acoes'
import {
  assinarIdentidade,
  COOKIE_DE_PARTICIPANTE,
  opcoesDoCookieDeParticipante,
} from '@/server/auth/participante'
import { corpo, responder } from '@/server/respostas'

type Contexto = { params: Promise<{ codigo: string }> }

// O limite de tamanho de verdade é do domínio; aqui o teto só existe para uma
// requisição absurda não chegar a virar consulta ao banco.
const entrada = z.object({ nome: z.string().min(1).max(200) })

export async function POST(pedido: Request, { params }: Contexto) {
  return responder(async () => {
    const { codigo } = await params
    const { nome } = await corpo(pedido, entrada)
    const entrou = await entrarNaCorrida(codigo, nome)

    // O cookie é a identidade inteira de quem participa: sem ele, recarregar a
    // página no meio da etapa devolveria a pessoa à tela de nome.
    const cookiesDaResposta = await cookies()
    cookiesDaResposta.set(
      COOKIE_DE_PARTICIPANTE,
      await assinarIdentidade({
        participanteId: entrou.participante.id,
        sessaoId: entrou.sessao.id,
      }),
      opcoesDoCookieDeParticipante()
    )

    return { nome: entrou.participante.nome }
  })
}
