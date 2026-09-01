import Link from 'next/link'

import { listarQuizzes } from '@/server/acoes'

import { ExcluirQuiz } from './ExcluirQuiz'
import { NovoQuiz } from './NovoQuiz'
import estilos from './lista.module.css'

export const dynamic = 'force-dynamic'

export default async function Quizzes() {
  const quizzes = await listarQuizzes()

  return (
    <section className={estilos.pagina}>
      <header className={estilos.cabecalho}>
        <div>
          <h1 className={`pixel ${estilos.titulo}`}>Seus quizzes</h1>
          <p className={estilos.explicacao}>
            Cada quiz tem um código de entrada próprio, que vai no QR Code
            projetado na parede.
          </p>
        </div>
        <NovoQuiz />
      </header>

      {quizzes.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhum quiz ainda. Crie o primeiro para começar a montar as etapas.
        </p>
      ) : (
        <ul className={estilos.grade}>
          {quizzes.map((item) => (
            <li key={item.id} className={estilos.cartao}>
              <Link
                href={`/admin/quizzes/${item.id}`}
                className={estilos.chamada}
              >
                <span className={`pixel ${estilos.codigo}`}>{item.codigo}</span>
                <h2 className={estilos.nome}>{item.titulo}</h2>
              </Link>
              <p className={`pixel ${estilos.numeros}`}>
                {item.etapas} {item.etapas === 1 ? 'ETAPA' : 'ETAPAS'} ·{' '}
                {item.perguntas}{' '}
                {item.perguntas === 1 ? 'PERGUNTA' : 'PERGUNTAS'}
              </p>
              <ExcluirQuiz quizId={item.id} titulo={item.titulo} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
