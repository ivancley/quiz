'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import estilos from './quiz.module.css'

export function TituloDoQuiz({
  quizId,
  titulo,
}: {
  quizId: string
  titulo: string
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(titulo)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const falha = await enviar(`/api/quizzes/${quizId}`, 'PATCH', {
      titulo: rascunho,
    })
    setErro(falha)
    if (falha) return

    setEditando(false)
    router.refresh()
  }

  function cancelar() {
    setRascunho(titulo)
    setErro(null)
    setEditando(false)
  }

  if (!editando) {
    return (
      <div className={estilos.tituloEmRepouso}>
        <h1 className={`pixel ${estilos.titulo}`}>{titulo}</h1>
        <BotaoRelevo tom="neutro" onClick={() => setEditando(true)}>
          RENOMEAR
        </BotaoRelevo>
      </div>
    )
  }

  return (
    <div className={estilos.tituloEmEdicao}>
      <input
        className={estilos.entradaGrande}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        maxLength={200}
        autoFocus
      />
      <BotaoRelevo tom="verde" onClick={salvar}>
        SALVAR
      </BotaoRelevo>
      <BotaoRelevo tom="neutro" onClick={cancelar}>
        CANCELAR
      </BotaoRelevo>
      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
