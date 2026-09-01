import { notFound, redirect } from 'next/navigation'

import { listarEtapas, quizPorCodigo, sessaoVivaDoQuiz } from '@/server/acoes'
import { identidadeAtual } from '@/server/auth/participante'

import { Entrada } from './Entrada'

// A porta de entrada muda de conteúdo a cada acesso — a sala pode ter aberto no
// segundo anterior —, então não há nada aqui que possa ser pré-renderizado.
export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ codigo: string }> }

export default async function PaginaDeEntrada({ params }: Contexto) {
  const { codigo } = await params

  const doCodigo = await quizPorCodigo(codigo)
  if (!doCodigo) notFound()

  const [viva, etapas, identidade] = await Promise.all([
    sessaoVivaDoQuiz(doCodigo.id),
    listarEtapas(doCodigo.id),
    identidadeAtual(),
  ])

  // Quem já está na grade e voltou ao endereço do QR não tem por que dizer o
  // nome de novo — a pessoa quer o jogo, não o formulário.
  if (viva && identidade?.sessaoId === viva.id) {
    redirect(`/e/${codigo}/jogo`)
  }

  return (
    <Entrada
      codigo={codigo}
      titulo={doCodigo.titulo}
      etapas={etapas.length}
      perguntas={etapas.reduce((total, etapa) => total + etapa.perguntas, 0)}
      salaAberta={viva !== null}
    />
  )
}
