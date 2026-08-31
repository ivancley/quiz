import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import {
  assinarSessaoDeAdmin,
  credencialConfere,
  lerSessaoDeAdmin,
} from '@/server/auth/admin'

const EMAIL = process.env.ADMIN_EMAIL as string
const SENHA = 'teste1234'

describe('credencial do administrador', () => {
  it('aceita o e-mail e a senha provisionados no ambiente', async () => {
    expect(await credencialConfere(EMAIL, SENHA)).toBe(true)
  })

  it('recusa a senha errada', async () => {
    expect(await credencialConfere(EMAIL, 'senha-errada')).toBe(false)
  })

  it('recusa um e-mail que não é o do administrador', async () => {
    expect(await credencialConfere('outra@pessoa.com', SENHA)).toBe(false)
  })

  it('ignora espaços e caixa do e-mail digitado', async () => {
    expect(await credencialConfere(`  ${EMAIL.toUpperCase()} `, SENHA)).toBe(
      true
    )
  })
})

describe('cookie de sessão do administrador', () => {
  it('emite um cookie que ele mesmo consegue reler', async () => {
    const token = await assinarSessaoDeAdmin(EMAIL)

    expect(await lerSessaoDeAdmin(token)).toEqual({ email: EMAIL })
  })

  it('recusa um cookie ausente', async () => {
    expect(await lerSessaoDeAdmin(undefined)).toBeNull()
  })

  it('recusa um cookie adulterado', async () => {
    const token = await assinarSessaoDeAdmin(EMAIL)
    // Mexer num caractere do payload invalida a assinatura sem quebrar o formato.
    const [cabecalho, conteudo, assinatura] = token.split('.')
    const adulterado = [
      cabecalho,
      `${conteudo.slice(0, -1)}X`,
      assinatura,
    ].join('.')

    expect(await lerSessaoDeAdmin(adulterado)).toBeNull()
  })

  it('recusa um cookie assinado com outra chave', async () => {
    const forjado = await new SignJWT({ email: EMAIL })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode('chave-de-quem-nao-e-o-servidor'))

    expect(await lerSessaoDeAdmin(forjado)).toBeNull()
  })

  it('recusa um cookie expirado', async () => {
    const vencido = await new SignJWT({ email: EMAIL })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1h')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET as string))

    expect(await lerSessaoDeAdmin(vencido)).toBeNull()
  })

  it('recusa um texto que não é um cookie', async () => {
    expect(await lerSessaoDeAdmin('nada-disso')).toBeNull()
  })
})
