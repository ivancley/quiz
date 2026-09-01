'use client'

import { useEffect, useRef, useState } from 'react'

import { Kart } from '@/components/Kart'
import { Moldura } from '@/components/Moldura'
import { enviarEReceber } from '@/lib/pedidos'
import type { Letra } from '@/server/db/schema'
import type { EstadoDoParticipante, Segmento } from '@/server/estado'

import estilos from './jogo.module.css'

type TelaDePergunta = Extract<EstadoDoParticipante, { tela: 'pergunta' }>

type Registro = { escolhida: Letra; correta: boolean }

/**
 * Tempo entre ver o retorno e a tela virar para a próxima pergunta. Curto o
 * bastante para não travar o ritmo da sala, longo o bastante para a pessoa ver
 * o que aconteceu com o que ela acabou de tocar.
 */
const PAUSA_DO_RETORNO = 900

/**
 * A tela de responder.
 *
 * O gabarito nunca chega aqui. Quem corrige é o servidor, e o retorno de acerto
 * ou erro só existe depois que a resposta foi registrada — antes disso não há
 * nada nesta tela que diga qual alternativa é a certa.
 */
export function Pergunta({
  codigo,
  estado,
  aoResponder,
}: {
  codigo: string
  estado: TelaDePergunta
  aoResponder: () => void
}) {
  const { eu, etapa, pergunta, segmentos } = estado
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [pontos, setPontos] = useState(estado.pontosNaEtapa)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const virada = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (virada.current) clearTimeout(virada.current)
    }
  }, [])

  async function responder(escolhida: Letra) {
    // A resposta é definitiva, e dois toques rápidos no mesmo botão são o
    // gesto mais comum de quem está com pressa.
    if (enviando || registro) return

    setEnviando(true)
    setErro(null)

    const { dados, erro: falha } = await enviarEReceber<{
      correta: boolean
      pontosNaEtapa: number
    }>(`/api/e/${codigo}/responder`, 'POST', {
      perguntaId: pergunta.id,
      escolhida,
    })

    setEnviando(false)

    if (!dados) {
      setErro(falha)
      return
    }

    setRegistro({ escolhida, correta: dados.correta })
    setPontos(dados.pontosNaEtapa)
    virada.current = setTimeout(aoResponder, PAUSA_DO_RETORNO)
  }

  return (
    <Moldura>
      <div className={estilos.corrida}>
        <header className={estilos.cabecalhoDaEtapa}>
          <div className={estilos.linha}>
            <span className={`pixel ${estilos.etapaEmFoco}`}>
              ETAPA {etapa.posicao} · VOLTA {pergunta.posicao}/{etapa.perguntas}
            </span>
            <span className={estilos.pontuacao}>
              <Kart participanteId={eu.id} nome={eu.nome} tamanho="pequeno" />
              <span className={`pixel ${estilos.destaque}`}>{pontos} PTS</span>
            </span>
          </div>

          <div className={estilos.segmentos}>
            {comRetorno(segmentos, pergunta.posicao, registro).map(
              (segmento, indice) => (
                // A barra tem um traço por pergunta da etapa, sempre na mesma
                // ordem: a posição é a identidade de cada traço.
                <span
                  key={indice}
                  className={`${estilos.segmento} ${estilos[segmento]}`}
                />
              )
            )}
          </div>
        </header>

        <h1 className={estilos.enunciado}>{pergunta.texto}</h1>

        <div className={estilos.alternativas}>
          {pergunta.alternativas.map((alternativa) => (
            <button
              key={alternativa.letra}
              type="button"
              className={`${estilos.alternativa} ${marcacao(registro, alternativa.letra)}`}
              disabled={enviando || registro !== null}
              onClick={() => responder(alternativa.letra)}
            >
              <span className={`pixel ${estilos.selo}`}>
                {alternativa.letra}
              </span>
              {alternativa.texto}
            </button>
          ))}
        </div>

        {erro ? (
          <p className={estilos.erro} role="alert">
            {erro}
          </p>
        ) : null}

        <footer className={estilos.rodapeDaEtapa}>
          <span className={`pixel ${estilos.bonus}`}>+3 +2 +1</span>
          <span className={estilos.legenda}>
            Bônus para os três primeiros a acertar. A resposta é definitiva.
          </span>
        </footer>
      </div>
    </Moldura>
  )
}

/**
 * A barra do topo com o retorno da resposta que acabou de sair, antes de o
 * servidor devolver o estado novo — é o que faz o toque parecer instantâneo.
 */
function comRetorno(
  segmentos: Segmento[],
  posicaoAtual: number,
  registro: Registro | null
): Segmento[] {
  if (!registro) return segmentos
  return segmentos.map((segmento, indice) =>
    indice === posicaoAtual - 1
      ? registro.correta
        ? 'acertou'
        : 'errou'
      : segmento
  )
}

/** Verde na alternativa certa, vermelho na errada — só depois de responder. */
function marcacao(registro: Registro | null, letra: Letra): string {
  if (!registro || registro.escolhida !== letra) return ''
  return registro.correta ? estilos.certa : estilos.errada
}
