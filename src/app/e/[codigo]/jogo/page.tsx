import { notFound, redirect } from 'next/navigation'

import { quizPorCodigo } from '@/server/acoes'
import { identidadeAtual } from '@/server/auth/participante'
import { estadoDoParticipante } from '@/server/estado'

import { Jogo } from './Jogo'

// A tela do jogo é o agora da sala; nada aqui pode ser pré-renderizado.
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ codigo: string }> }

export default async function PaginaDoJogo({ params }: Contexto) {
  const { codigo } = await params

  const doCodigo = await quizPorCodigo(codigo)
  if (!doCodigo) notFound()

  const estado = await estadoDoParticipante(doCodigo, await identidadeAtual())

  // Quem ainda não tem kart — ou perdeu o cookie, ou a sala nem abriu — não tem
  // jogo para ver: o caminho é a porta de entrada.
  if (estado.tela === 'entrada' || estado.tela === 'sem-sessao') {
    redirect(`/e/${codigo}`)
  }

  return <Jogo codigo={codigo} inicial={estado} />
}
