import { NextResponse } from 'next/server'

import { sessaoDeAdminAtual } from '@/server/auth/admin'
import { estadoDoPainel } from '@/server/estado'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ sessionId: string }> }

/** O painel refaz esta consulta a cada aviso de que algo mudou. */
export async function GET(_pedido: Request, { params }: Contexto) {
  if (!(await sessaoDeAdminAtual())) {
    return NextResponse.json(
      { erro: 'Entre como administrador para continuar.' },
      { status: 401 }
    )
  }

  const { sessionId } = await params
  const estado = await estadoDoPainel(sessionId)

  if (!estado) {
    return NextResponse.json(
      { erro: 'Sessão não encontrada.' },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { dados: estado },
    // O painel está sempre lendo o agora; uma resposta guardada em cache
    // mostraria um placar velho para quem acabou de receber o aviso.
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
