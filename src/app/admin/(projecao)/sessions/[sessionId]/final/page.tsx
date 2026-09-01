import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Kart } from '@/components/Kart'
import { buscarSessao, buscarQuiz } from '@/server/acoes'
import { placarDaSessao } from '@/server/placar'

import estilos from './final.module.css'

export const dynamic = 'force-dynamic'

/** As alturas do pódio, na ordem em que os três primeiros aparecem na tela. */
const PODIO = [
  { posicao: 2, classe: 'segundo' },
  { posicao: 1, classe: 'primeiro' },
  { posicao: 3, classe: 'terceiro' },
] as const

export default async function PlacarFinal({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const sessao = await buscarSessao(sessionId)
  if (!sessao) notFound()

  const [quiz, placar] = await Promise.all([
    buscarQuiz(sessao.quizId),
    placarDaSessao(sessionId),
  ])
  if (!quiz) notFound()

  const noPodio = PODIO.map((degrau) => ({
    ...degrau,
    linha: placar[degrau.posicao - 1],
  })).filter((degrau) => degrau.linha)

  return (
    <main className={estilos.tela}>
      <header className={estilos.cabecalho}>
        <span className={estilos.bandeira} aria-hidden="true" />
        <div>
          <h1 className={`pixel ${estilos.titulo}`}>BANDEIRADA FINAL</h1>
          <p className={estilos.nomeDoQuiz}>{quiz.titulo}</p>
        </div>
      </header>

      {placar.length === 0 ? (
        <p className={estilos.vazio}>
          Esta sessão terminou sem ninguém na grade.
        </p>
      ) : (
        <>
          <section className={estilos.podio} aria-label="Pódio">
            {noPodio.map(({ posicao, classe, linha }) => (
              <div
                key={linha.participanteId}
                className={`${estilos.degrau} ${estilos[classe]}`}
              >
                <Kart
                  participanteId={linha.participanteId}
                  nome={linha.nome}
                  tamanho={posicao === 1 ? 'enorme' : 'grande'}
                  destacado={posicao === 1}
                />
                <span className={estilos.nomeNoPodio}>{linha.nome}</span>
                <span className={`pixel ${estilos.pontosNoPodio}`}>
                  {linha.total} PTS
                </span>
                <div className={estilos.bloco}>
                  <span className={`pixel ${estilos.lugar}`}>{posicao}º</span>
                </div>
              </div>
            ))}
          </section>

          <section className={estilos.tabela}>
            <table>
              <caption className={`pixel ${estilos.legenda}`}>
                CLASSIFICAÇÃO COMPLETA
              </caption>
              <thead>
                <tr className="pixel">
                  <th scope="col">POS</th>
                  <th scope="col">PARTICIPANTE</th>
                  <th scope="col">ACERTOS</th>
                  <th scope="col">BÔNUS</th>
                  <th scope="col">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {placar.map((linha) => (
                  <tr key={linha.participanteId}>
                    <td className={`pixel ${estilos.posicao}`}>
                      {String(linha.posicao).padStart(2, '0')}
                    </td>
                    <td className={estilos.nomeNaTabela}>
                      <Kart
                        participanteId={linha.participanteId}
                        nome={linha.nome}
                        tamanho="pequeno"
                      />
                      {linha.nome}
                    </td>
                    <td className="pixel">{linha.acertos}</td>
                    <td className={`pixel ${estilos.bonus}`}>{linha.bonus}</td>
                    <td className={`pixel ${estilos.total}`}>{linha.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <footer className={estilos.rodape}>
        <Link href={`/admin/quizzes/${quiz.id}`} className={estilos.link}>
          ← Voltar ao quiz
        </Link>
      </footer>
    </main>
  )
}
