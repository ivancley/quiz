import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buscarEtapa, buscarQuiz, listarPerguntas } from '@/server/acoes'

import { Perguntas } from './Perguntas'
import estilos from './etapa.module.css'

export const dynamic = 'force-dynamic'

export default async function PaginaDaEtapa({
  params,
}: {
  params: Promise<{ quizId: string; stageId: string }>
}) {
  const { quizId, stageId } = await params
  const [quiz, etapa] = await Promise.all([
    buscarQuiz(quizId),
    buscarEtapa(stageId),
  ])

  // A etapa precisa ser deste quiz: sem a conferência, trocar o identificador
  // na barra de endereço abriria a etapa de outro quiz sob o título errado.
  if (!quiz || !etapa || etapa.quizId !== quizId) notFound()

  const perguntas = await listarPerguntas(stageId)

  return (
    <section className={estilos.pagina}>
      <Link
        href={`/admin/quizzes/${quizId}`}
        className={`pixel ${estilos.voltar}`}
      >
        ← {quiz.titulo}
      </Link>

      <header className={estilos.cabecalho}>
        <span className={`pixel ${estilos.posicao}`}>
          ETAPA {String(etapa.posicao).padStart(2, '0')}
        </span>
        <h1 className={`pixel ${estilos.titulo}`}>{etapa.titulo}</h1>
        <p className={estilos.explicacao}>
          As perguntas são feitas nesta ordem, uma por vez, para a sala inteira.
        </p>
      </header>

      <Perguntas etapaId={stageId} perguntas={perguntas} />
    </section>
  )
}
