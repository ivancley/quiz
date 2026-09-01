'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { Kart } from '@/components/Kart'
import { numeroDoKart } from '@/lib/kart'
import { enviar } from '@/lib/pedidos'
import type { EstadoDoPainel } from '@/server/estado'

import estilos from './painel.module.css'

/** Onde fica a linha de chegada da pista quando ninguém pontuou muito ainda. */
const META_MINIMA = 40

export function Painel({
  sessaoId,
  inicial,
}: {
  sessaoId: string
  inicial: EstadoDoPainel
}) {
  const [estado, setEstado] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const recarregar = useCallback(async () => {
    const resposta = await fetch(`/api/sessions/${sessaoId}/state`, {
      cache: 'no-store',
    })
    if (!resposta.ok) return
    const { dados } = await resposta.json()
    setEstado(dados)
  }, [sessaoId])

  useEffect(() => {
    // O aviso não carrega o que mudou: ele só diz que mudou, e a tela vai
    // buscar o estado inteiro de novo. Reconectar passa a ser, sozinho, uma
    // ressincronização — o navegador reconecta o EventSource por conta própria.
    const canal = new EventSource(`/api/sessions/${sessaoId}/events`)
    canal.addEventListener('atualizar', () => {
      void recarregar()
    })

    // Aba em segundo plano ou celular bloqueado deixam a tela para trás; voltar
    // a ela é motivo para conferir o estado, mesmo sem aviso novo.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void recarregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      canal.close()
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [sessaoId, recarregar])

  async function conduzir(corpo: Record<string, string>) {
    setOcupado(true)
    const falha = await enviar(`/api/sessions/${sessaoId}`, 'PATCH', corpo)
    setErro(falha)
    setOcupado(false)
    if (!falha) await recarregar()
  }

  const { sessao, etapas, participantes, progresso, placar } = estado
  const etapaAberta = sessao.etapaStatus === 'aberta'
  const etapaAtual = etapas.find((e) => e.id === sessao.etapaAtualId)
  const proxima = proximaEtapa(etapas, sessao.etapaAtualId)
  const finalizada = sessao.status === 'finalizada'

  const meta = Math.max(META_MINIMA, ...placar.map((l) => l.total))
  const porParticipante = new Map(participantes.map((p) => [p.id, p]))

  return (
    <main className={estilos.tela}>
      <header className={estilos.barra}>
        <span
          className={`pixel ${estilos.situacao} ${finalizada ? estilos.parada : estilos.aoVivo}`}
        >
          ● {finalizada ? 'ENCERRADA' : 'AO VIVO'}
        </span>
        <h1 className={`pixel ${estilos.nomeDoQuiz}`}>{estado.quiz.titulo}</h1>
        {etapaAtual ? (
          <span className={`pixel ${estilos.contagemDeEtapa}`}>
            ETAPA {etapaAtual.posicao} / {etapas.length}
          </span>
        ) : null}
      </header>

      <section className={estilos.controle}>
        <div className={estilos.etapaEmFoco}>
          <span className={`pixel ${estilos.rotulo}`}>
            {etapaAberta ? 'ETAPA ABERTA' : 'NENHUMA ETAPA ABERTA'}
          </span>
          <span className={estilos.nomeDaEtapa}>
            {etapaAtual ? etapaAtual.titulo : 'A corrida ainda não começou'}
          </span>
        </div>

        <div className={estilos.acoes}>
          <BotaoRelevo
            tom="vermelho"
            onClick={() => conduzir({ acao: 'encerrar-etapa' })}
            disabled={ocupado || !etapaAberta}
          >
            ENCERRAR ETAPA
          </BotaoRelevo>

          <BotaoRelevo
            tom="verde"
            onClick={() =>
              proxima && conduzir({ acao: 'abrir-etapa', etapaId: proxima.id })
            }
            disabled={ocupado || etapaAberta || !proxima || finalizada}
          >
            {proxima
              ? `INICIAR ETAPA ${proxima.posicao}`
              : 'TODAS AS ETAPAS FEITAS'}
          </BotaoRelevo>

          <BotaoRelevo
            tom="neutro"
            onClick={() => {
              if (
                window.confirm('Dar a bandeirada final e encerrar a sessão?')
              ) {
                void conduzir({ acao: 'finalizar' })
              }
            }}
            disabled={ocupado || finalizada}
          >
            BANDEIRADA FINAL
          </BotaoRelevo>
        </div>
      </section>

      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}

      <div className={estilos.corpo}>
        <section className={estilos.pista}>
          <h2 className={`pixel ${estilos.rotulo}`}>PISTA</h2>

          {placar.length === 0 ? (
            <p className={estilos.vazio}>
              Ninguém na grade ainda. Projete o QR Code para a sala entrar.
            </p>
          ) : (
            <ol className={estilos.raias}>
              {placar.map((linha) => {
                const pessoa = porParticipante.get(linha.participanteId)
                return (
                  <li key={linha.participanteId} className={estilos.raia}>
                    <span className={`pixel ${estilos.posicao}`}>
                      {String(linha.posicao).padStart(2, '0')}
                    </span>

                    <div className={estilos.trilho}>
                      <div
                        className={estilos.kart}
                        style={{ left: `${(linha.total / meta) * 100}%` }}
                      >
                        <Kart
                          participanteId={linha.participanteId}
                          nome={linha.nome}
                        />
                      </div>
                    </div>

                    <span className={estilos.nomeNaRaia}>{linha.nome}</span>
                    <span className={`pixel ${estilos.numeroDoKart}`}>
                      KART {numeroDoKart(pessoa?.numero ?? 0)}
                    </span>
                    <span className={`pixel ${estilos.pontos}`}>
                      {linha.total} PTS
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <aside className={estilos.lateral}>
          <section className={estilos.bloco}>
            <h2 className={`pixel ${estilos.rotulo}`}>PROGRESSO DA ETAPA</h2>
            {progresso.length === 0 ? (
              <p className={estilos.vazio}>Nenhuma etapa aberta.</p>
            ) : (
              <ul className={estilos.perguntas}>
                {progresso.map((pergunta) => (
                  <li key={pergunta.id} className={estilos.pergunta}>
                    <div className={estilos.linhaDaPergunta}>
                      <span className={`pixel ${estilos.numeroDaPergunta}`}>
                        {String(pergunta.posicao).padStart(2, '0')}
                      </span>
                      <span className={`pixel ${estilos.contagem}`}>
                        {pergunta.respondidas} / {participantes.length}
                      </span>
                    </div>
                    <div className={estilos.barraDeProgresso}>
                      <div
                        className={estilos.preenchido}
                        style={{
                          width: `${porcentagem(pergunta.respondidas, participantes.length)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={estilos.bloco}>
            <h2 className={`pixel ${estilos.rotulo}`}>
              NA GRADE · {participantes.length}
            </h2>
            <div className={estilos.selos}>
              {participantes.map((pessoa) => (
                <span key={pessoa.id} title={pessoa.nome}>
                  <Kart
                    participanteId={pessoa.id}
                    nome={pessoa.nome}
                    tamanho="pequeno"
                  />
                </span>
              ))}
            </div>
          </section>

          <section className={estilos.bloco}>
            <h2 className={`pixel ${estilos.rotulo}`}>COMO SE PONTUA</h2>
            <p className={estilos.legenda}>
              Cada acerto vale 1 ponto. Os três primeiros a acertar cada
              pergunta ganham <strong>+3</strong>, <strong>+2</strong> e{' '}
              <strong>+1</strong>.
            </p>
          </section>

          <Link
            href={`/admin/quizzes/${estado.quiz.id}`}
            className={estilos.link}
          >
            ← Voltar ao quiz
          </Link>
        </aside>
      </div>
    </main>
  )
}

/** A etapa seguinte à que está em foco; a primeira, se ainda não começou. */
function proximaEtapa(
  etapas: EstadoDoPainel['etapas'],
  etapaAtualId: string | null
) {
  if (!etapaAtualId) return etapas[0]
  const indice = etapas.findIndex((e) => e.id === etapaAtualId)
  return etapas[indice + 1]
}

function porcentagem(parte: number, todo: number): number {
  return todo === 0 ? 0 : Math.round((parte / todo) * 100)
}
