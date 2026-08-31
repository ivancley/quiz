import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  assinarSessaoDeAdmin,
  COOKIE_DE_ADMIN,
  credencialConfere,
  opcoesDoCookieDeAdmin,
} from '@/server/auth/admin'

const entrada = z.object({
  email: z.string().min(1),
  senha: z.string().min(1),
})

export async function POST(pedido: Request) {
  const corpo = entrada.safeParse(await pedido.json().catch(() => null))

  // Campo faltando e credencial errada dão a mesma resposta: distinguir os dois
  // casos só ajudaria quem está tentando adivinhar o e-mail do administrador.
  if (
    !corpo.success ||
    !(await credencialConfere(corpo.data.email, corpo.data.senha))
  ) {
    return NextResponse.json({ erro: 'Credencial inválida.' }, { status: 401 })
  }

  const resposta = NextResponse.json({ ok: true })
  resposta.cookies.set(
    COOKIE_DE_ADMIN,
    await assinarSessaoDeAdmin(corpo.data.email.trim().toLowerCase()),
    opcoesDoCookieDeAdmin()
  )
  return resposta
}
