import { Kart } from '@/components/Kart'
import { Moldura } from '@/components/Moldura'
import { numeroDoKart } from '@/lib/kart'
import type { EstadoDoParticipante } from '@/server/estado'

import type { Conexao } from './Jogo'
import { Sinal } from './Sinal'
import estilos from './jogo.module.css'

type Espera = Extract<EstadoDoParticipante, { tela: 'espera' }>

/**
 * A sala de espera. Não há nada para fazer aqui, e é justamente esse o recado:
 * a tela vira sozinha quando o organizador der a largada.
 */
export function Espera({
  estado,
  conexao,
}: {
  estado: Espera
  conexao: Conexao
}) {
  const { eu, naGrade, proxima } = estado

  return (
    <Moldura fundo="linear-gradient(180deg, #1a2140 0%, var(--tela) 60%)">
      <div className={`${estilos.tela} ${estilos.centrada}`}>
        <Sinal conexao={conexao} />

        <div className={estilos.semaforo} aria-hidden="true">
          <span className={`${estilos.luz} ${estilos.luzAcesa}`} />
          <span className={estilos.luz} />
          <span className={estilos.luz} />
        </div>

        <div className={estilos.chamada}>
          <h1 className={`pixel ${estilos.titulo}`}>Aguardando a largada</h1>
          <p className={estilos.recado}>
            A tela muda sozinha quando o organizador abrir a etapa.
          </p>
        </div>

        <section className={estilos.cartao}>
          <div className={estilos.piloto}>
            <Kart participanteId={eu.id} nome={eu.nome} tamanho="grande" />
            <div className={estilos.identificacao}>
              <span className={estilos.nome}>{eu.nome}</span>
              <span className={`pixel ${estilos.rotulo}`}>
                KART {numeroDoKart(eu.numero)} · NA GRADE
              </span>
            </div>
          </div>

          <div className={estilos.divisor} />

          <div className={estilos.linha}>
            <span>Participantes na pista</span>
            <span className={`pixel ${estilos.destaque}`}>{naGrade}</span>
          </div>
        </section>

        <div className={estilos.preparando}>
          <div className={estilos.trilho} aria-hidden="true">
            <div className={estilos.listras} />
          </div>
          <span className={`pixel ${estilos.rotulo}`}>
            {proxima
              ? `PREPARANDO ETAPA ${proxima.posicao}`
              : 'AGUARDANDO O ORGANIZADOR'}
          </span>
        </div>
      </div>
    </Moldura>
  )
}
