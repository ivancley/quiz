'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'
import { enviar } from '@/lib/pedidos'

import estilos from './lista.module.css'

export function NovoQuiz() {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setSalvando(true)

    const falha = await enviar('/api/quizzes', 'POST', { titulo })
    setErro(falha)
    setSalvando(false)

    if (!falha) {
      setTitulo('')
      router.refresh()
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={criar}>
      <label className={estilos.campo}>
        <span className={`pixel ${estilos.rotulo}`}>NOVO QUIZ</span>
        <input
          className={estilos.entrada}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título do quiz"
          maxLength={200}
          required
        />
      </label>
      <BotaoRelevo type="submit" tom="verde" disabled={salvando}>
        CRIAR
      </BotaoRelevo>
      {erro ? (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      ) : null}
    </form>
  )
}
