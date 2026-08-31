'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { BotaoRelevo } from '@/components/BotaoRelevo'

import estilos from './login.module.css'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)

    try {
      const resposta = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })

      if (!resposta.ok) {
        setErro('E-mail ou senha incorretos.')
        return
      }

      router.replace('/admin')
      // O layout da área lê o cookie no servidor; sem o refresh a navegação
      // reaproveitaria a árvore que ainda foi renderizada sem sessão.
      router.refresh()
    } catch {
      setErro('Não foi possível falar com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className={estilos.pagina}>
      <form className={estilos.cartao} onSubmit={entrar}>
        <header className={estilos.cabecalho}>
          <span className={`pixel ${estilos.sobretitulo}`}>
            GRAND PRIX DO CONHECIMENTO
          </span>
          <h1 className={`pixel ${estilos.titulo}`}>Área do organizador</h1>
        </header>

        <label className={estilos.campo}>
          <span className={`pixel ${estilos.rotulo}`}>E-MAIL</span>
          <input
            className={estilos.entrada}
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className={estilos.campo}>
          <span className={`pixel ${estilos.rotulo}`}>SENHA</span>
          <input
            className={estilos.entrada}
            type="password"
            name="senha"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        {erro ? (
          <p className={estilos.erro} role="alert">
            {erro}
          </p>
        ) : null}

        <BotaoRelevo type="submit" largo disabled={enviando}>
          {enviando ? 'ENTRANDO…' : 'ENTRAR'}
        </BotaoRelevo>

        <p className={estilos.rodape}>
          Só quem organiza a dinâmica precisa entrar aqui. Quem participa entra
          pelo QR Code projetado.
        </p>
      </form>
    </main>
  )
}
