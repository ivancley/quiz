import { NextResponse } from 'next/server'

import { COOKIE_DE_ADMIN, opcoesDoCookieDeAdmin } from '@/server/auth/admin'

export async function POST() {
  const resposta = NextResponse.json({ ok: true })
  // Mesmos atributos da emissão: um cookie removido com path diferente daquele
  // com que foi gravado sobrevive à remoção.
  resposta.cookies.set(COOKIE_DE_ADMIN, '', {
    ...opcoesDoCookieDeAdmin(),
    maxAge: 0,
  })
  return resposta
}
