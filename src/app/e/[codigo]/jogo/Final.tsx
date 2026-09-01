import { Kart } from '@/components/Kart'
import { Moldura } from '@/components/Moldura'
import { numeroDoKart } from '@/lib/kart'
import type { EstadoDoParticipante } from '@/server/estado'

import estilos from './jogo.module.css'

type Final = Extract<EstadoDoParticipante, { tela: 'final' }>

/**
 * A corrida acabou.
 *
 * Depois da bandeirada, o celular de quem jogou continua servindo para alguma
 * coisa: mostrar o que a pessoa fez. Mandá-la de volta à tela de nome, ou pior,
 * a uma tela de erro, apagaria a tarde inteira dela.
 */
export function Final({ estado }: { estado: Final }) {
  const { quiz, eu, total, posicao, naGrade } = estado

  return (
    <Moldura fundo="linear-gradient(180deg, #1d1730 0%, var(--tela) 55%)">
      <div className={`${estilos.tela} ${estilos.centrada}`}>
        <header className={estilos.fecho}>
          <span className={`pixel ${estilos.destaque}`}>BANDEIRADA FINAL</span>
          <h1 className={`pixel ${estilos.titulo}`}>{quiz.titulo}</h1>
        </header>

        <div className={estilos.piloto}>
          <Kart participanteId={eu.id} nome={eu.nome} tamanho="grande" />
          <div className={estilos.identificacao}>
            <span className={estilos.nome}>{eu.nome}</span>
            <span className={`pixel ${estilos.rotulo}`}>
              KART {numeroDoKart(eu.numero)}
            </span>
          </div>
        </div>

        <section className={estilos.cartaoDePontos}>
          <span className={`pixel ${estilos.rotulo}`}>SUA POSIÇÃO</span>
          <span className={`pixel ${estilos.numeroGrande}`}>{posicao}º</span>
          <span className={estilos.legenda}>
            de {naGrade} {naGrade === 1 ? 'participante' : 'participantes'}
          </span>
        </section>

        <div className={estilos.dupla}>
          <div className={estilos.cartaoPequeno}>
            <span className={`pixel ${estilos.rotulo}`}>PONTOS</span>
            <span className={`pixel ${estilos.numeroMedio}`}>{total}</span>
          </div>
        </div>

        <p className={estilos.recado}>
          O placar completo está na projeção. Obrigado por correr.
        </p>
      </div>
    </Moldura>
  )
}
