import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buscarQuiz, numerosDaProjecao } from '@/server/acoes'
import { enderecoDeEntrada, qrEmSvg } from '@/server/qr'

import estilos from './projecao.module.css'

export const dynamic = 'force-dynamic'

export default async function Projecao({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const { quizId } = await params
  const quiz = await buscarQuiz(quizId)
  if (!quiz) notFound()

  const [numeros, codigoEmSvg] = await Promise.all([
    numerosDaProjecao(quizId),
    qrEmSvg(quiz.codigo),
  ])
  const endereco = enderecoDeEntrada(quiz.codigo)

  return (
    <main className={estilos.tela}>
      <header className={estilos.barra}>
        <span className={estilos.bandeira} aria-hidden="true" />
        <h1 className={`pixel ${estilos.nomeDoQuiz}`}>{quiz.titulo}</h1>
        <span
          className={`pixel ${estilos.situacao} ${
            numeros.salaAberta ? estilos.aberta : estilos.fechada
          }`}
        >
          ● {numeros.salaAberta ? 'SESSÃO ABERTA' : 'AGUARDANDO SESSÃO'}
        </span>
      </header>

      <div className={estilos.corpo}>
        <section className={estilos.instrucao}>
          <p className={`pixel ${estilos.chamada}`}>
            APONTE A CÂMERA DO CELULAR
          </p>

          <p className={estilos.endereco}>{endereco}</p>
          <p className={estilos.alternativa}>
            Ou digite o endereço e informe o código{' '}
            <strong className="pixel">{quiz.codigo}</strong>.
          </p>

          <ul className={estilos.numeros}>
            <li className={estilos.numero}>
              <span className={`pixel ${estilos.valor}`}>
                {numeros.naGrade}
              </span>
              <span className={`pixel ${estilos.rotulo}`}>NA GRADE</span>
            </li>
            <li className={estilos.numero}>
              <span className={`pixel ${estilos.valor}`}>{numeros.etapas}</span>
              <span className={`pixel ${estilos.rotulo}`}>ETAPAS</span>
            </li>
            <li className={estilos.numero}>
              <span className={`pixel ${estilos.valor}`}>
                {numeros.perguntas}
              </span>
              <span className={`pixel ${estilos.rotulo}`}>PERGUNTAS</span>
            </li>
          </ul>
        </section>

        <section className={estilos.moldura}>
          {/* O SVG vem do gerador no servidor, não de conteúdo de usuário. */}
          <div
            className={estilos.codigo}
            dangerouslySetInnerHTML={{ __html: codigoEmSvg }}
          />
        </section>
      </div>

      <footer className={estilos.rodape}>
        <Link href={`/admin/quizzes/${quizId}`} className={estilos.link}>
          ← Voltar ao quiz
        </Link>
        <a href={`/api/quizzes/${quizId}/qr`} className={estilos.link} download>
          Baixar o QR Code
        </a>
      </footer>
    </main>
  )
}
