import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

import { RecusaDeRegra } from '@/server/db/erros'

/**
 * Ponte entre as ações do domínio e o HTTP.
 *
 * Uma recusa de regra vira a resposta que ela mesma descreve. Qualquer outro
 * erro sobe: quem trata é o Next.js, que registra o rastro no servidor e
 * devolve um 500 sem detalhe — nome de tabela e de constraint não têm por que
 * chegar ao navegador.
 */

export async function corpo<T>(
  pedido: Request,
  esquema: ZodType<T>
): Promise<T> {
  const lido = await pedido.json().catch(() => null)
  const validado = esquema.safeParse(lido)

  if (!validado.success) {
    throw new RecusaDeRegra('Os dados enviados não estão completos.', 400)
  }

  return validado.data
}

export async function responder<T>(
  acao: () => Promise<T>
): Promise<NextResponse> {
  try {
    return NextResponse.json({ dados: await acao() })
  } catch (erro) {
    if (erro instanceof RecusaDeRegra) {
      return NextResponse.json({ erro: erro.motivo }, { status: erro.status })
    }
    throw erro
  }
}
