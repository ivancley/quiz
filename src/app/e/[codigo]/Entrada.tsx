'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { Moldura } from '@/components/Moldura'
import { CORES_DE_KART, inicialDoNome } from '@/lib/kart'
import { enviar } from '@/lib/pedidos'
import type { ResumoDoQuiz } from '@/server/estado'

import estilos from './entrada.module.css'

/**
 * A cor definitiva do kart sai do identificador do participante, que só existe
 * depois da entrada. Aqui a prévia mostra a forma e a inicial — a primeira cor
 * da paleta, para o selo não nascer sem cor nenhuma.
 */
const PREVIA_DO_KART = CORES_DE_KART[0]

/**
 * De quanto em quanto tempo a tela pergunta se a sala já abriu.
 *
 * Aqui não há canal de avisos: ele é assinado por sessão, e a sessão é
 * justamente o que ainda não existe. Alguns segundos de espera são o preço de
 * não pedir a ninguém que fique recarregando a página.
 */
const INTERVALO_DE_ESPERA = 3000

type Props = {
  codigo: string
  quiz: ResumoDoQuiz
  salaAberta: boolean
}

export function Entrada({ codigo, quiz, salaAberta }: Props) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    if (salaAberta) return

    const relogio = setInterval(async () => {
      const resposta = await fetch(`/api/e/${codigo}/estado`, {
        cache: 'no-store',
      })
      if (!resposta.ok) return

      const { dados } = await resposta.json()
      if (dados.tela !== 'sem-sessao') router.refresh()
    }, INTERVALO_DE_ESPERA)

    return () => clearInterval(relogio)
  }, [salaAberta, codigo, router])

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setEntrando(true)

    const falha = await enviar(`/api/e/${codigo}/entrar`, 'POST', { nome })
    setErro(falha)

    if (falha) {
      setEntrando(false)
      return
    }

    // O cookie acabou de ser emitido, e é o servidor que decide a tela: navegar
    // sem o refresh reaproveitaria a árvore renderizada antes de haver kart.
    router.replace(`/e/${codigo}/jogo`)
    router.refresh()
  }

  return (
    <Moldura fundo="linear-gradient(180deg, var(--superficie) 0%, var(--tela) 55%)">
      <form className={estilos.tela} onSubmit={entrar}>
        <header className={estilos.cabecalho}>
          <span className={`pixel ${estilos.sobretitulo}`}>
            GRAND PRIX DO CONHECIMENTO
          </span>
          <h1 className={`pixel ${estilos.titulo}`}>{quiz.titulo}</h1>
          <p className={estilos.resumo}>
            {contar(quiz.etapas, 'etapa', 'etapas')} ·{' '}
            {contar(quiz.perguntas, 'pergunta', 'perguntas')}
          </p>
        </header>

        <div className={estilos.previa}>
          <span
            className={`pixel ${estilos.kart}`}
            style={{
              background: PREVIA_DO_KART.fundo,
              color: PREVIA_DO_KART.texto,
              boxShadow: `0 6px 0 ${PREVIA_DO_KART.sombra}`,
            }}
            aria-hidden="true"
          >
            {inicialDoNome(nome)}
          </span>
          <span className={`pixel ${estilos.rotulo}`}>SEU KART</span>
        </div>

        {salaAberta ? (
          <>
            <label className={estilos.campo}>
              <span className={`pixel ${estilos.rotulo}`}>SEU NOME</span>
              <input
                className={estilos.entrada}
                name="nome"
                autoComplete="name"
                autoFocus
                required
                maxLength={40}
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
              />
              <span className={estilos.dica}>
                Esse nome aparece no ranking da projeção.
              </span>
            </label>

            {erro ? (
              <p className={estilos.erro} role="alert">
                {erro}
              </p>
            ) : null}

            <div className={estilos.rodape}>
              <BotaoRelevo
                type="submit"
                largo
                disabled={entrando || nome.trim() === ''}
              >
                {entrando ? 'ENTRANDO…' : 'ENTRAR NA CORRIDA'}
              </BotaoRelevo>
              <p className={estilos.legenda}>
                Sem cadastro. Sem instalar nada.
              </p>
            </div>
          </>
        ) : (
          <div className={estilos.aguardando} role="status">
            <span className={`pixel ${estilos.rotulo}`}>
              SALA AINDA FECHADA
            </span>
            <p className={estilos.recado}>
              O quiz ainda não começou. Deixe esta tela aberta: ela pede seu
              nome assim que o organizador abrir a sala.
            </p>
          </div>
        )}
      </form>
    </Moldura>
  )
}

function contar(quantos: number, singular: string, plural: string): string {
  return `${quantos} ${quantos === 1 ? singular : plural}`
}
