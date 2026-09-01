'use client'

import { useCallback, useEffect, useState } from 'react'

import type { EstadoDoParticipante } from '@/server/estado'

import { Espera } from './Espera'
import { Pergunta } from './Pergunta'
import { Resultado } from './Resultado'

/**
 * O celular da pessoa que está jogando.
 *
 * Ele não decide nada sobre a dinâmica: recebe do servidor qual tela mostrar e
 * desenha. Quando chega um aviso de que algo mudou, vai buscar o estado inteiro
 * de novo — o aviso não carrega o que mudou, e é isso que faz de reconectar a
 * mesma coisa que ressincronizar.
 */

export type Conexao = 'conectado' | 'reconectando'

export function Jogo({
  codigo,
  inicial,
}: {
  codigo: string
  inicial: EstadoDoParticipante
}) {
  const [estado, setEstado] = useState(inicial)
  const [conexao, setConexao] = useState<Conexao>('reconectando')

  const recarregar = useCallback(async () => {
    const resposta = await fetch(`/api/e/${codigo}/estado`, {
      cache: 'no-store',
    })
    if (!resposta.ok) return
    const { dados } = await resposta.json()
    setEstado(dados)
  }, [codigo])

  const sessaoId = 'sessaoId' in estado ? estado.sessaoId : null

  useEffect(() => {
    if (!sessaoId) return

    // `como=participante` restringe o que chega a este aparelho às mudanças de
    // rumo da dinâmica. Sem isso, cinquenta respostas virariam cinquenta avisos
    // vezes cinquenta celulares, e a sala inteira recarregaria à toa.
    const canal = new EventSource(
      `/api/sessions/${sessaoId}/events?como=participante`
    )

    canal.addEventListener('atualizar', () => {
      setConexao('conectado')
      void recarregar()
    })
    canal.addEventListener('open', () => setConexao('conectado'))
    // O `EventSource` reconecta sozinho; até conseguir, a tela diz que está
    // fora do ar em vez de fingir que o que está desenhado ainda é o agora.
    canal.addEventListener('error', () => setConexao('reconectando'))

    // Celular bloqueado e aba em segundo plano deixam a tela para trás; voltar
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

  switch (estado.tela) {
    case 'espera':
      return <Espera estado={estado} conexao={conexao} />
    case 'pergunta':
      return (
        // A chave é a pergunta: virar a volta zera o que a tela guardava sobre
        // a resposta anterior, sem precisar limpar campo por campo.
        <Pergunta
          key={estado.pergunta.id}
          codigo={codigo}
          estado={estado}
          aoResponder={recarregar}
        />
      )
    case 'resultado-etapa':
      return <Resultado estado={estado} />
    default:
      return null
  }
}
