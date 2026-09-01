'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import estilos from './lista.module.css'

export function ExcluirQuiz({
  quizId,
  titulo,
}: {
  quizId: string
  titulo: string
}) {
  const router = useRouter()
  const [excluindo, setExcluindo] = useState(false)

  async function excluir() {
    // Excluir leva junto etapas, perguntas e o histórico de sessões, e não há
    // como desfazer; a confirmação é o único freio entre o clique e a perda.
    const confirmado = window.confirm(
      `Excluir "${titulo}"? As etapas, as perguntas e as sessões já realizadas vão junto.`
    )
    if (!confirmado) return

    setExcluindo(true)
    const falha = await enviar(`/api/quizzes/${quizId}`, 'DELETE')
    setExcluindo(false)

    if (falha) {
      window.alert(falha)
      return
    }
    router.refresh()
  }

  return (
    <BotaoRelevo
      tom="neutro"
      onClick={excluir}
      disabled={excluindo}
      className={estilos.excluir}
    >
      EXCLUIR
    </BotaoRelevo>
  )
}
