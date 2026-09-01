import { NextResponse } from 'next/server'

import { quizPorCodigo } from '@/server/acoes'
import { identidadeAtual } from '@/server/auth/participante'
import { estadoDoParticipante } from '@/server/estado'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ codigo: string }> }

/**
 * O celular refaz esta consulta a cada aviso de que algo mudou. O aviso não diz
 * o que mudou — quem responde qual tela mostrar é sempre este endpoint.
 */
export async function GET(_pedido: Request, { params }: Contexto) {
  const { codigo } = await params
  const doCodigo = await quizPorCodigo(codigo)

  if (!doCodigo) {
    return NextResponse.json({ erro: 'Quiz não encontrado.' }, { status: 404 })
  }

  const estado = await estadoDoParticipante(doCodigo, await identidadeAtual())

  return NextResponse.json(
    { dados: estado },
    // A tela está sempre lendo o agora; uma resposta guardada em cache deixaria
    // o celular na pergunta anterior depois de a etapa já ter virado.
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
