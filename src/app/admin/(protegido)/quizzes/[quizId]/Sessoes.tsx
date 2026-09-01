'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import estilos from './quiz.module.css'

type Sessao = {
  id: string
  status: 'aguardando' | 'em_andamento' | 'finalizada'
  iniciadaEm: Date
  finalizadaEm: Date | null
  participantes: number
}

const SITUACAO = {
  aguardando: 'NA LARGADA',
  em_andamento: 'AO VIVO',
  finalizada: 'ENCERRADA',
} as const

export function Sessoes({
  quizId,
  sessoes,
}: {
  quizId: string
  sessoes: Sessao[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const viva = sessoes.find((s) => s.status !== 'finalizada')

  async function executar(acao: () => Promise<string | null>) {
    setOcupado(true)
    const falha = await acao()
    setErro(falha)
    setOcupado(false)
    if (!falha) router.refresh()
  }

  async function abrir() {
    await executar(() => enviar(`/api/quizzes/${quizId}/sessions`, 'POST'))
  }

  async function encerrar(sessaoId: string) {
    const confirmado = window.confirm(
      'Encerrar a sessão? O placar fica salvo, mas ninguém mais responde.'
    )
    if (!confirmado) return

    await executar(() =>
      enviar(`/api/sessions/${sessaoId}`, 'PATCH', { acao: 'finalizar' })
    )
  }

  return (
    <div className={estilos.sessoes}>
      <div className={estilos.tituloDaSecao}>
        <h2 className={`pixel ${estilos.rotulo}`}>SESSÕES</h2>
        <p className={estilos.explicacao}>
          Cada turma corre em uma sessão própria, com placar próprio. Uma por
          vez.
        </p>
      </div>

      {viva ? (
        <div className={estilos.sessaoViva}>
          <span className={`pixel ${estilos.aoVivo}`}>
            ● {SITUACAO[viva.status]}
          </span>
          <span className={estilos.detalhe}>
            {viva.participantes}{' '}
            {viva.participantes === 1 ? 'pessoa na grade' : 'pessoas na grade'}{' '}
            · aberta {quando(viva.iniciadaEm)}
          </span>
          <Link
            href={`/admin/sessions/${viva.id}`}
            className={`pixel ${estilos.abrirPainel}`}
          >
            ABRIR PAINEL →
          </Link>
          <BotaoRelevo
            tom="vermelho"
            onClick={() => encerrar(viva.id)}
            disabled={ocupado}
          >
            ENCERRAR SESSÃO
          </BotaoRelevo>
        </div>
      ) : (
        <BotaoRelevo
          tom="azul"
          onClick={abrir}
          disabled={ocupado}
          className={estilos.abrirSessao}
        >
          INICIAR SESSÃO
        </BotaoRelevo>
      )}

      {sessoes.some((s) => s.status === 'finalizada') ? (
        <ul className={estilos.historico}>
          {sessoes
            .filter((s) => s.status === 'finalizada')
            .map((sessao) => (
              <li key={sessao.id} className={estilos.sessaoAntiga}>
                <span className={`pixel ${estilos.encerrada}`}>
                  {SITUACAO.finalizada}
                </span>
                <span className={estilos.detalhe}>
                  {quando(sessao.iniciadaEm)} · {sessao.participantes}{' '}
                  {sessao.participantes === 1
                    ? 'participante'
                    : 'participantes'}
                </span>
                <Link
                  href={`/admin/sessions/${sessao.id}/final`}
                  className={`pixel ${estilos.abrirPainel}`}
                >
                  VER PLACAR →
                </Link>
              </li>
            ))}
        </ul>
      ) : null}

      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

function quando(instante: Date): string {
  return new Date(instante).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
