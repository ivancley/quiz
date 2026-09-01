'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import {
  FormularioDePergunta,
  LETRAS,
  RASCUNHO_VAZIO,
  type Letra,
  type Rascunho,
} from './FormularioDePergunta'
import estilos from './etapa.module.css'

type Pergunta = Rascunho & {
  id: string
  posicao: number
}

export function Perguntas({
  etapaId,
  perguntas,
}: {
  etapaId: string
  perguntas: Pergunta[]
}) {
  const router = useRouter()
  const [emEdicao, setEmEdicao] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function executar(acao: () => Promise<string | null>) {
    setOcupado(true)
    const falha = await acao()
    setErro(falha)
    setOcupado(false)
    if (!falha) router.refresh()
    return falha
  }

  async function criar(rascunho: Rascunho) {
    const falha = await executar(() =>
      enviar(`/api/stages/${etapaId}/questions`, 'POST', rascunho)
    )
    if (!falha) setAdicionando(false)
  }

  async function salvar(perguntaId: string, rascunho: Rascunho) {
    const falha = await executar(() =>
      enviar(`/api/questions/${perguntaId}`, 'PATCH', rascunho)
    )
    if (!falha) setEmEdicao(null)
  }

  async function mover(perguntaId: string, direcao: 'cima' | 'baixo') {
    await executar(() =>
      enviar(`/api/questions/${perguntaId}`, 'PATCH', { mover: direcao })
    )
  }

  async function excluir(pergunta: Pergunta) {
    if (!window.confirm(`Excluir a pergunta "${pergunta.texto}"?`)) return
    await executar(() => enviar(`/api/questions/${pergunta.id}`, 'DELETE'))
  }

  return (
    <div className={estilos.perguntas}>
      {perguntas.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhuma pergunta ainda. Uma etapa sem perguntas não tem o que rodar.
        </p>
      ) : (
        <ol className={estilos.lista}>
          {perguntas.map((pergunta, indice) => (
            <li key={pergunta.id} className={estilos.cartao}>
              {emEdicao === pergunta.id ? (
                <FormularioDePergunta
                  valorInicial={pergunta}
                  rotuloDeEnvio="SALVAR"
                  ocupado={ocupado}
                  aoEnviar={(rascunho) => salvar(pergunta.id, rascunho)}
                  aoCancelar={() => setEmEdicao(null)}
                />
              ) : (
                <>
                  <div className={estilos.linhaDoTopo}>
                    <span className={`pixel ${estilos.numero}`}>
                      {String(pergunta.posicao).padStart(2, '0')}
                    </span>
                    <p className={estilos.enunciadoLido}>{pergunta.texto}</p>
                  </div>

                  <ul className={estilos.alternativasLidas}>
                    {LETRAS.map((letra) => (
                      <li
                        key={letra}
                        className={`${estilos.alternativaLida} ${
                          pergunta.correta === letra ? estilos.correta : ''
                        }`}
                      >
                        <span className={`pixel ${estilos.letra}`}>
                          {letra}
                        </span>
                        <span>{textoDaAlternativa(pergunta, letra)}</span>
                        {pergunta.correta === letra ? (
                          <span className={`pixel ${estilos.selo}`}>
                            CORRETA
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  <div className={estilos.acoes}>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => mover(pergunta.id, 'cima')}
                      disabled={ocupado || indice === 0}
                      aria-label="Subir esta pergunta"
                    >
                      ↑
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => mover(pergunta.id, 'baixo')}
                      disabled={ocupado || indice === perguntas.length - 1}
                      aria-label="Descer esta pergunta"
                    >
                      ↓
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => setEmEdicao(pergunta.id)}
                    >
                      EDITAR
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => excluir(pergunta)}
                      disabled={ocupado}
                    >
                      EXCLUIR
                    </BotaoRelevo>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {adicionando ? (
        <div className={estilos.cartao}>
          <FormularioDePergunta
            valorInicial={RASCUNHO_VAZIO}
            rotuloDeEnvio="ADICIONAR"
            ocupado={ocupado}
            aoEnviar={criar}
            aoCancelar={() => setAdicionando(false)}
          />
        </div>
      ) : (
        <BotaoRelevo
          tom="verde"
          onClick={() => setAdicionando(true)}
          className={estilos.adicionar}
        >
          NOVA PERGUNTA
        </BotaoRelevo>
      )}

      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

function textoDaAlternativa(pergunta: Pergunta, letra: Letra): string {
  if (letra === 'A') return pergunta.altA
  if (letra === 'B') return pergunta.altB
  if (letra === 'C') return pergunta.altC
  return pergunta.altD
}
