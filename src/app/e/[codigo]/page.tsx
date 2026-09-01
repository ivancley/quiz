import { notFound, redirect } from 'next/navigation'

import { quizPorCodigo } from '@/server/acoes'
import { identidadeAtual } from '@/server/auth/participante'
import { estadoDoParticipante } from '@/server/estado'

import { Entrada } from './Entrada'

// A porta de entrada muda de conteúdo a cada acesso — a sala pode ter aberto no
// segundo anterior —, então não há nada aqui que possa ser pré-renderizado.
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ codigo: string }> }

export default async function PaginaDeEntrada({ params }: Contexto) {
  const { codigo } = await params

  const doCodigo = await quizPorCodigo(codigo)
  if (!doCodigo) notFound()

  const estado = await estadoDoParticipante(doCodigo, await identidadeAtual())

  // Quem já tem kart não precisa dizer o nome de novo — nem quem está esperando
  // a largada, nem quem voltou depois da bandeirada para ver o próprio placar.
  if (estado.tela !== 'entrada' && estado.tela !== 'sem-sessao') {
    redirect(`/e/${codigo}/jogo`)
  }

  return (
    <Entrada
      codigo={codigo}
      quiz={estado.quiz}
      salaAberta={estado.tela === 'entrada'}
    />
  )
}
