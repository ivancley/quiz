import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

import { segredoDeAssinatura } from '@/server/ambiente'

/**
 * Quem participa não tem cadastro, senha nem e-mail: a identidade inteira cabe
 * num cookie assinado com o participante e a sessão em que ele entrou.
 *
 * Assinado, e não opaco: sem tabela de tokens, sem consulta a mais em cada
 * requisição e sem nada para expirar. `httpOnly` porque o celular fica na mão
 * de quem está jogando — um cookie legível por JavaScript convidaria a trocar a
 * identidade pela de outra pessoa direto do console.
 */

export const COOKIE_DE_PARTICIPANTE = 'qz_participante'

const ALGORITMO = 'HS256'

/**
 * Uma dinâmica dura uma tarde. Doze horas cobrem o dia inteiro com folga, e
 * um cookie que sobrevivesse à semana só serviria para devolver alguém a uma
 * sessão que já acabou.
 */
const VALIDADE = '12h'

export type Identidade = {
  participanteId: string
  sessaoId: string
}

export async function assinarIdentidade(
  identidade: Identidade
): Promise<string> {
  return new SignJWT({ ...identidade })
    .setProtectedHeader({ alg: ALGORITMO })
    .setIssuedAt()
    .setExpirationTime(VALIDADE)
    .sign(segredoDeAssinatura())
}

/**
 * Devolve a identidade contida no cookie, ou null se ele estiver ausente,
 * expirado ou assinado com outra chave. Nunca lança: para a tela, um cookie
 * inválido e um cookie ausente são a mesma coisa — pedir o nome de novo.
 */
export async function lerIdentidade(
  token: string | undefined
): Promise<Identidade | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredoDeAssinatura(), {
      algorithms: [ALGORITMO],
    })
    const { participanteId, sessaoId } = payload
    return typeof participanteId === 'string' && typeof sessaoId === 'string'
      ? { participanteId, sessaoId }
      : null
  } catch {
    return null
  }
}

/** Atributos do cookie, num lugar só, para emissão e remoção não divergirem. */
export function opcoesDoCookieDeParticipante() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    // Em desenvolvimento a aplicação roda em http; exigir HTTPS aqui faria o
    // navegador descartar o cookie silenciosamente na máquina do desenvolvedor.
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function identidadeAtual(): Promise<Identidade | null> {
  const cookiesDoPedido = await cookies()
  return lerIdentidade(cookiesDoPedido.get(COOKIE_DE_PARTICIPANTE)?.value)
}
