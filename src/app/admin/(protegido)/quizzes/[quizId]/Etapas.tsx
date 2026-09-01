'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import estilos from './quiz.module.css'

type Etapa = {
  id: string
  posicao: number
  titulo: string
  perguntas: number
}

export function Etapas({
  quizId,
  etapas,
}: {
  quizId: string
  etapas: Etapa[]
}) {
  const router = useRouter()
  const [nova, setNova] = useState('')
  const [emEdicao, setEmEdicao] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
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

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const falha = await executar(() =>
      enviar(`/api/quizzes/${quizId}/stages`, 'POST', { titulo: nova })
    )
    if (!falha) setNova('')
  }

  async function renomear(etapaId: string) {
    const falha = await executar(() =>
      enviar(`/api/stages/${etapaId}`, 'PATCH', { titulo: rascunho })
    )
    if (!falha) setEmEdicao(null)
  }

  async function mover(etapaId: string, direcao: 'cima' | 'baixo') {
    await executar(() =>
      enviar(`/api/stages/${etapaId}`, 'PATCH', { mover: direcao })
    )
  }

  async function excluir(etapa: Etapa) {
    const aviso =
      etapa.perguntas > 0
        ? `Excluir "${etapa.titulo}"? As ${etapa.perguntas} perguntas dela vão junto.`
        : `Excluir "${etapa.titulo}"?`
    if (!window.confirm(aviso)) return

    await executar(() => enviar(`/api/stages/${etapa.id}`, 'DELETE'))
  }

  return (
    <div className={estilos.etapas}>
      <div className={estilos.tituloDaSecao}>
        <h2 className={`pixel ${estilos.rotulo}`}>ETAPAS</h2>
        <p className={estilos.explicacao}>
          A dinâmica corre nesta ordem: uma etapa por vez, do topo para baixo.
        </p>
      </div>

      {etapas.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhuma etapa ainda. A primeira que você criar abre a corrida.
        </p>
      ) : (
        <ol className={estilos.listaDeEtapas}>
          {etapas.map((etapa, indice) => (
            <li key={etapa.id} className={estilos.etapa}>
              <span className={`pixel ${estilos.posicao}`}>
                {String(etapa.posicao).padStart(2, '0')}
              </span>

              {emEdicao === etapa.id ? (
                <>
                  <input
                    className={estilos.entrada}
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                    maxLength={200}
                    autoFocus
                  />
                  <BotaoRelevo
                    tom="verde"
                    onClick={() => renomear(etapa.id)}
                    disabled={ocupado}
                  >
                    SALVAR
                  </BotaoRelevo>
                  <BotaoRelevo tom="neutro" onClick={() => setEmEdicao(null)}>
                    CANCELAR
                  </BotaoRelevo>
                </>
              ) : (
                <>
                  <Link
                    href={`/admin/quizzes/${quizId}/stages/${etapa.id}`}
                    className={estilos.nomeDaEtapa}
                  >
                    {etapa.titulo}
                  </Link>
                  <span className={`pixel ${estilos.numeros}`}>
                    {etapa.perguntas}{' '}
                    {etapa.perguntas === 1 ? 'PERGUNTA' : 'PERGUNTAS'}
                  </span>
                  <div className={estilos.acoes}>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => mover(etapa.id, 'cima')}
                      disabled={ocupado || indice === 0}
                      aria-label={`Subir a etapa ${etapa.titulo}`}
                    >
                      ↑
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => mover(etapa.id, 'baixo')}
                      disabled={ocupado || indice === etapas.length - 1}
                      aria-label={`Descer a etapa ${etapa.titulo}`}
                    >
                      ↓
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => {
                        setRascunho(etapa.titulo)
                        setEmEdicao(etapa.id)
                      }}
                    >
                      RENOMEAR
                    </BotaoRelevo>
                    <BotaoRelevo
                      tom="neutro"
                      onClick={() => excluir(etapa)}
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

      <form className={estilos.formulario} onSubmit={criar}>
        <label className={estilos.campo}>
          <span className={`pixel ${estilos.rotulo}`}>NOVA ETAPA</span>
          <input
            className={estilos.entrada}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Título da etapa"
            maxLength={200}
            required
          />
        </label>
        <BotaoRelevo type="submit" tom="verde" disabled={ocupado}>
          ADICIONAR
        </BotaoRelevo>
      </form>

      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
