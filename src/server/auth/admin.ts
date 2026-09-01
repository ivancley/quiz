import { compare } from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  emailDoAdministrador,
  hashDaSenhaDoAdministrador,
  segredoDeAssinatura,
} from '@/server/ambiente'
import { RecusaDeRegra } from '@/server/db/erros'

/**
 * Há um administrador só, provisionado por variável de ambiente: não existe
 * cadastro, recuperação de senha nem tabela de usuários. A identidade dele vive
 * inteira num cookie assinado, então o banco não guarda nada de autenticação.
 */

export const COOKIE_DE_ADMIN = 'qz_admin'

const ALGORITMO = 'HS256'
const VALIDADE = '12h'

/**
 * Uma dinâmica dura uma tarde; doze horas cobrem o dia de trabalho inteiro sem
 * deixar a credencial viva indefinidamente num computador de sala de aula.
 */

export type SessaoDeAdmin = { email: string }

export async function credencialConfere(
  email: string,
  senha: string
): Promise<boolean> {
  const esperado = emailDoAdministrador()
  const hash = hashDaSenhaDoAdministrador()

  // O bcrypt roda mesmo com o e-mail errado: comparar só quando o e-mail bate
  // faria o tempo de resposta revelar qual é o e-mail do administrador.
  const senhaConfere = await compare(senha, hash)
  const emailConfere = email.trim().toLowerCase() === esperado.toLowerCase()

  return senhaConfere && emailConfere
}

export async function assinarSessaoDeAdmin(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: ALGORITMO })
    .setIssuedAt()
    .setExpirationTime(VALIDADE)
    .sign(segredoDeAssinatura())
}

/**
 * Devolve a sessão contida no cookie, ou null se ele estiver ausente, expirado
 * ou assinado com outra chave. Nunca lança: quem chama trata a ausência como
 * "não autenticado", que é a mesma coisa do ponto de vista da tela.
 */
export async function lerSessaoDeAdmin(
  token: string | undefined
): Promise<SessaoDeAdmin | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredoDeAssinatura(), {
      algorithms: [ALGORITMO],
    })
    const email = payload.email
    return typeof email === 'string' ? { email } : null
  } catch {
    return null
  }
}

/** Atributos do cookie, num lugar só, para emissão e remoção não divergirem. */
export function opcoesDoCookieDeAdmin() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    // Em desenvolvimento a aplicação roda em http; exigir HTTPS aqui faria o
    // navegador descartar o cookie silenciosamente na máquina do desenvolvedor.
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function sessaoDeAdminAtual(): Promise<SessaoDeAdmin | null> {
  const cookiesDoPedido = await cookies()
  return lerSessaoDeAdmin(cookiesDoPedido.get(COOKIE_DE_ADMIN)?.value)
}

/**
 * Guarda da área administrativa: devolve a sessão ou desvia para o login.
 * Aplicada no layout, cobre de uma vez toda página aninhada — inclusive as que
 * ainda não existem, que é onde esse tipo de proteção costuma ser esquecida.
 */
export async function exigirAdministrador(): Promise<SessaoDeAdmin> {
  const sessao = await sessaoDeAdminAtual()
  if (!sessao) redirect('/admin/login')
  return sessao
}

/**
 * A mesma guarda para as rotas de escrita, que não podem responder com um
 * desvio: quem chamou espera JSON, não a tela de login em HTML.
 */
export async function exigirAdministradorNaApi(): Promise<SessaoDeAdmin> {
  const sessao = await sessaoDeAdminAtual()
  if (!sessao) {
    throw new RecusaDeRegra('Entre como administrador para continuar.', 401)
  }
  return sessao
}
