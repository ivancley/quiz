import { Moldura } from '@/components/Moldura'
import type { EstadoDoParticipante } from '@/server/estado'
import { PONTO_POR_ACERTO } from '@/server/pontuacao'

import estilos from './jogo.module.css'

type TelaDeResultado = Extract<
  EstadoDoParticipante,
  { tela: 'resultado-etapa' }
>

/**
 * O fecho da etapa: o que a pessoa fez, quanto valeu e onde ela está.
 *
 * O ranking completo não aparece aqui — quem participa vê a própria posição, e
 * a lista inteira fica na projeção que o organizador conduz.
 */
export function Resultado({ estado }: { estado: TelaDeResultado }) {
  const { etapa, encerrada, volta, pontosNaEtapa, total, posicao, proxima } =
    estado

  const acertos = volta.filter((ponto) => ponto.acertou).length
  const bonus = pontosNaEtapa - acertos * PONTO_POR_ACERTO

  return (
    <Moldura fundo="linear-gradient(180deg, #1d1730 0%, var(--tela) 55%)">
      <div className={estilos.tela}>
        <header className={estilos.fecho}>
          <span className={`pixel ${estilos.destaque}`}>
            {encerrada ? `ETAPA ${etapa.posicao} ENCERRADA` : 'VOLTA COMPLETA'}
          </span>
          <h1 className={`pixel ${estilos.titulo}`}>Seu resultado</h1>
        </header>

        <section className={estilos.cartaoDePontos}>
          <span className={`pixel ${estilos.rotulo}`}>PONTOS DESTA ETAPA</span>
          <span className={`pixel ${estilos.numeroGrande}`}>
            {pontosNaEtapa}
          </span>
          <span className={estilos.legenda}>
            {contar(acertos, 'acerto', 'acertos')} ·{' '}
            {bonus === 1 ? '1 de bônus' : `${bonus} de bônus`} de velocidade
          </span>
        </section>

        <div className={estilos.dupla}>
          <div className={estilos.cartaoPequeno}>
            <span className={`pixel ${estilos.rotulo}`}>TOTAL</span>
            <span className={`pixel ${estilos.numeroMedio}`}>{total}</span>
          </div>
          <div className={`${estilos.cartaoPequeno} ${estilos.emVerde}`}>
            <span className={`pixel ${estilos.rotulo}`}>POSIÇÃO</span>
            <span className={`pixel ${estilos.numeroMedio}`}>{posicao}º</span>
          </div>
        </div>

        <section className={estilos.suaVolta}>
          <span className={`pixel ${estilos.rotulo}`}>SUA VOLTA</span>
          <ul className={estilos.perguntas}>
            {volta.map((ponto) => (
              <li key={ponto.perguntaId} className={estilos.linha}>
                <span className={estilos.tituloDaPergunta}>
                  {ponto.posicao} · {ponto.texto}
                </span>
                <span
                  className={
                    ponto.pontos > 0 ? estilos.ganhou : estilos.semPonto
                  }
                >
                  {ponto.pontos > 0 ? `+${ponto.pontos}` : '0'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className={estilos.aguardando} role="status">
          <span className={estilos.pontoAzul} aria-hidden="true" />
          {aviso(encerrada, etapa.posicao, proxima?.posicao)}
        </p>
      </div>
    </Moldura>
  )
}

/** O que a pessoa está esperando agora — sempre alguém, nunca ela mesma. */
function aviso(
  encerrada: boolean,
  etapaAtual: number,
  proxima: number | undefined
): string {
  if (!encerrada) {
    return `Aguardando o resto da sala terminar a etapa ${etapaAtual}.`
  }
  return proxima
    ? `Aguardando o organizador abrir a etapa ${proxima}.`
    : 'Foi a última etapa. Aguardando a bandeirada final.'
}

function contar(quantos: number, singular: string, plural: string): string {
  return `${quantos} ${quantos === 1 ? singular : plural}`
}
