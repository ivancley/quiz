import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buscarQuiz, listarEtapas, listarSessoes } from '@/server/acoes'

import { Etapas } from './Etapas'
import { Sessoes } from './Sessoes'
import { TituloDoQuiz } from './TituloDoQuiz'
import estilos from './quiz.module.css'

export const dynamic = 'force-dynamic'

export default async function PaginaDoQuiz({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const { quizId } = await params
  const encontrado = await buscarQuiz(quizId)
  if (!encontrado) notFound()

  const [etapas, sessoes] = await Promise.all([
    listarEtapas(quizId),
    listarSessoes(quizId),
  ])
  // Com uma sessão no ar, o conteúdo do quiz está congelado: mexer nele mudaria
  // o critério de correção de respostas já registradas.
  const rodando = sessoes.some((sessao) => sessao.status !== 'finalizada')

  return (
    <section className={estilos.pagina}>
      <Link href="/admin" className={`pixel ${estilos.voltar}`}>
        ← TODOS OS QUIZZES
      </Link>

      <header className={estilos.cabecalho}>
        <TituloDoQuiz quizId={quizId} titulo={encontrado.titulo} />
        <div className={estilos.codigo}>
          <span className={`pixel ${estilos.rotulo}`}>CÓDIGO DE ENTRADA</span>
          <span className={`pixel ${estilos.valorDoCodigo}`}>
            {encontrado.codigo}
          </span>
          <Link
            href={`/admin/quizzes/${quizId}/qr`}
            className={`pixel ${estilos.projetar}`}
          >
            PROJETAR QR →
          </Link>
        </div>
      </header>

      <Sessoes quizId={quizId} sessoes={sessoes} />

      <Etapas quizId={quizId} etapas={etapas} congelado={rodando} />
    </section>
  )
}
