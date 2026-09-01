import { SignJWT } from 'jose'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { entrarNaCorrida, finalizarSessao, quizPorCodigo } from '@/server/acoes'
import {
  assinarIdentidade,
  lerIdentidade,
  opcoesDoCookieDeParticipante,
} from '@/server/auth/participante'
import { RecusaDeRegra } from '@/server/db/erros'

import {
  criarEtapa,
  criarPergunta,
  criarQuiz,
  criarSessao,
  fecharBanco,
  limparBanco,
} from '../helpers/banco'

beforeEach(limparBanco)
afterAll(fecharBanco)

/** Um quiz com uma etapa de uma pergunta e a sala já aberta. */
async function salaAberta() {
  const quiz = await criarQuiz('Formação de Professores')
  const etapa = await criarEtapa(quiz.id, 1, 'Currículo em ação')
  await criarPergunta(etapa.id, 1, 'B')
  const sessao = await criarSessao(quiz.id)
  return { quiz, etapa, sessao }
}

describe('endereço de entrada', () => {
  it('leva ao quiz do código impresso no QR', async () => {
    const { quiz } = await salaAberta()

    expect((await quizPorCodigo(quiz.codigo))?.id).toBe(quiz.id)
  })

  it('ignora a caixa de quem digitou o código à mão', async () => {
    const { quiz } = await salaAberta()

    expect((await quizPorCodigo(quiz.codigo.toUpperCase()))?.id).toBe(quiz.id)
  })

  it('não leva a lugar nenhum quando o código não existe', async () => {
    expect(await quizPorCodigo('NAOEXISTE')).toBeNull()
  })
})

describe('entrada na corrida', () => {
  it('põe na grade quem informou um nome', async () => {
    const { quiz, sessao } = await salaAberta()

    const entrada = await entrarNaCorrida(quiz.codigo, 'Marina Alves')

    expect(entrada.participante.nome).toBe('Marina Alves')
    expect(entrada.sessao.id).toBe(sessao.id)
  })

  it('recusa o nome vazio', async () => {
    const { quiz } = await salaAberta()

    await expect(entrarNaCorrida(quiz.codigo, '   ')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa um nome longo demais para caber na raia', async () => {
    const { quiz } = await salaAberta()

    await expect(entrarNaCorrida(quiz.codigo, 'M'.repeat(41))).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('normaliza os espaços em volta e no meio do nome', async () => {
    const { quiz } = await salaAberta()

    const entrada = await entrarNaCorrida(quiz.codigo, '  Marina   Alves  ')

    expect(entrada.participante.nome).toBe('Marina Alves')
  })

  it('recusa um nome já usado na mesma sessão', async () => {
    const { quiz } = await salaAberta()
    await entrarNaCorrida(quiz.codigo, 'Marina')

    await expect(entrarNaCorrida(quiz.codigo, 'Marina')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa o mesmo nome escrito com outra caixa', async () => {
    const { quiz } = await salaAberta()
    await entrarNaCorrida(quiz.codigo, 'Marina')

    await expect(entrarNaCorrida(quiz.codigo, 'MARINA')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('deixa o mesmo nome entrar em outra turma do mesmo quiz', async () => {
    const { quiz, sessao } = await salaAberta()
    await entrarNaCorrida(quiz.codigo, 'Marina')
    await finalizarSessao(sessao.id)
    await criarSessao(quiz.id)

    const entrada = await entrarNaCorrida(quiz.codigo, 'Marina')

    expect(entrada.participante.nome).toBe('Marina')
  })

  it('recusa a entrada enquanto não houver sala aberta', async () => {
    const quiz = await criarQuiz('Formação de Professores')

    await expect(entrarNaCorrida(quiz.codigo, 'Marina')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa a entrada por um código que não existe', async () => {
    await expect(entrarNaCorrida('NAOEXISTE', 'Marina')).rejects.toThrow(
      RecusaDeRegra
    )
  })
})

describe('cookie do participante', () => {
  const identidade = {
    participanteId: '11111111-1111-1111-1111-111111111111',
    sessaoId: '22222222-2222-2222-2222-222222222222',
  }

  it('emite um cookie que ele mesmo consegue reler', async () => {
    const token = await assinarIdentidade(identidade)

    expect(await lerIdentidade(token)).toEqual(identidade)
  })

  it('fica fora do alcance do JavaScript da página', () => {
    expect(opcoesDoCookieDeParticipante().httpOnly).toBe(true)
  })

  it('recusa um cookie ausente', async () => {
    expect(await lerIdentidade(undefined)).toBeNull()
  })

  it('recusa um cookie adulterado', async () => {
    const token = await assinarIdentidade(identidade)
    // Mexer num caractere do payload invalida a assinatura sem quebrar o formato.
    const [cabecalho, conteudo, assinatura] = token.split('.')
    const adulterado = [
      cabecalho,
      `${conteudo.slice(0, -1)}X`,
      assinatura,
    ].join('.')

    expect(await lerIdentidade(adulterado)).toBeNull()
  })

  it('recusa um cookie assinado com outra chave', async () => {
    const forjado = await new SignJWT({ ...identidade })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode('chave-de-quem-nao-e-o-servidor'))

    expect(await lerIdentidade(forjado)).toBeNull()
  })

  it('recusa um cookie expirado', async () => {
    const vencido = await new SignJWT({ ...identidade })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('-1h')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET as string))

    expect(await lerIdentidade(vencido)).toBeNull()
  })
})
