import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  abrirEtapa,
  encerrarEtapa,
  entrarNaCorrida,
  finalizarSessao,
  quizPorCodigo,
  registrarResposta,
} from '@/server/acoes'
import { perguntaEmJogo } from '@/server/apresentacao'
import type { Identidade } from '@/server/auth/participante'
import { RecusaDeRegra } from '@/server/db/erros'
import { estadoDoParticipante } from '@/server/estado'
import { placarDaSessao } from '@/server/placar'

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

/** Um quiz de duas etapas, com a primeira aberta e uma pessoa dentro. */
async function corridaEmAndamento() {
  const quiz = await criarQuiz('Formação de Professores')
  const primeira = await criarEtapa(quiz.id, 1, 'Currículo em ação')
  const segunda = await criarEtapa(quiz.id, 2, 'Avaliação formativa')
  const perguntas = {
    primeira: [
      await criarPergunta(primeira.id, 1, 'B'),
      await criarPergunta(primeira.id, 2, 'B'),
    ],
    segunda: [await criarPergunta(segunda.id, 1, 'B')],
  }
  const sessao = await criarSessao(quiz.id)
  const { participante: marina } = await entrarNaCorrida(quiz.codigo, 'Marina')
  await abrirEtapa(sessao.id, primeira.id)

  const identidade: Identidade = {
    participanteId: marina.id,
    sessaoId: sessao.id,
  }

  return { quiz, primeira, segunda, perguntas, sessao, marina, identidade }
}

describe('registro de resposta', () => {
  it('corrige no servidor e devolve os pontos da etapa', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()

    const retorno = await registrarResposta(
      identidade,
      perguntas.primeira[0].id,
      'B'
    )

    // Primeira a acertar: 1 ponto do acerto mais 3 de bônus de velocidade.
    expect(retorno).toEqual({ correta: true, pontosNaEtapa: 4 })
  })

  it('devolve zero ponto para quem errou', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()

    const retorno = await registrarResposta(
      identidade,
      perguntas.primeira[0].id,
      'A'
    )

    expect(retorno).toEqual({ correta: false, pontosNaEtapa: 0 })
  })

  it('acumula os pontos ao longo da etapa', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()
    await registrarResposta(identidade, perguntas.primeira[0].id, 'B')

    const retorno = await registrarResposta(
      identidade,
      perguntas.primeira[1].id,
      'B'
    )

    expect(retorno.pontosNaEtapa).toBe(8)
  })

  it('recusa a segunda resposta à mesma pergunta', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()
    await registrarResposta(identidade, perguntas.primeira[0].id, 'A')

    await expect(
      registrarResposta(identidade, perguntas.primeira[0].id, 'B')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa resposta a pergunta de etapa que não está aberta', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()

    await expect(
      registrarResposta(identidade, perguntas.segunda[0].id, 'B')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa resposta depois de a etapa ter sido encerrada', async () => {
    const { perguntas, sessao, identidade } = await corridaEmAndamento()
    await encerrarEtapa(sessao.id)

    await expect(
      registrarResposta(identidade, perguntas.primeira[0].id, 'B')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa resposta depois da bandeirada final', async () => {
    const { perguntas, sessao, identidade } = await corridaEmAndamento()
    await finalizarSessao(sessao.id)

    await expect(
      registrarResposta(identidade, perguntas.primeira[0].id, 'B')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa quem não está mais na sala', async () => {
    const { perguntas, sessao } = await corridaEmAndamento()

    await expect(
      registrarResposta(
        {
          participanteId: '00000000-0000-0000-0000-000000000000',
          sessaoId: sessao.id,
        },
        perguntas.primeira[0].id,
        'B'
      )
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa uma pergunta que não existe', async () => {
    const { identidade } = await corridaEmAndamento()

    await expect(
      registrarResposta(identidade, '00000000-0000-0000-0000-000000000000', 'B')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('encerra a etapa sozinha quando foi a última resposta que faltava', async () => {
    const { quiz, perguntas, identidade } = await corridaEmAndamento()

    for (const pergunta of perguntas.primeira) {
      await registrarResposta(identidade, pergunta.id, 'B')
    }

    const doCodigo = await quizPorCodigo(quiz.codigo)
    const estado = await estadoDoParticipante(doCodigo!, identidade)
    expect(estado).toMatchObject({ tela: 'resultado-etapa', encerrada: true })
  })

  it('aceita vinte respostas simultâneas à mesma pergunta', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const etapa = await criarEtapa(quiz.id, 1, 'Currículo em ação')
    const pergunta = await criarPergunta(etapa.id, 1, 'B')
    const sessao = await criarSessao(quiz.id)

    const identidades: Identidade[] = []
    for (let numero = 1; numero <= 20; numero += 1) {
      const { participante } = await entrarNaCorrida(
        quiz.codigo,
        `Piloto ${numero}`
      )
      identidades.push({ participanteId: participante.id, sessaoId: sessao.id })
    }
    await abrirEtapa(sessao.id, etapa.id)

    // O momento de maior concorrência da dinâmica: a sala inteira tocando na
    // mesma alternativa. Nenhuma dessas respostas pode ser recusada — inclusive
    // as que chegam junto com o encerramento automático que elas mesmas causam.
    const retornos = await Promise.all(
      identidades.map((identidade) =>
        registrarResposta(identidade, pergunta.id, 'B')
      )
    )

    expect(retornos.every((retorno) => retorno.correta)).toBe(true)

    // A ordem de acerto é decidida pelos dados, e não no instante da escrita:
    // o placar final é onde ela aparece sem ambiguidade.
    const totais = (await placarDaSessao(sessao.id))
      .map((linha) => linha.total)
      .sort((a, b) => b - a)
    expect(totais).toEqual([4, 3, 2, ...Array.from({ length: 17 }, () => 1)])
  })
})

describe('fronteira do gabarito', () => {
  it('a pergunta entregue ao celular não carrega a alternativa correta', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const etapa = await criarEtapa(quiz.id, 1, 'Currículo em ação')
    const linha = await criarPergunta(etapa.id, 1, 'B')

    const entregue = perguntaEmJogo(linha)

    expect(Object.keys(entregue)).toEqual([
      'id',
      'posicao',
      'texto',
      'alternativas',
    ])
    expect(JSON.stringify(entregue)).not.toContain('correta')
  })

  it('o estado com a etapa aberta não diz nada sobre o gabarito', async () => {
    const { quiz, identidade } = await corridaEmAndamento()

    const doCodigo = await quizPorCodigo(quiz.codigo)
    const estado = await estadoDoParticipante(doCodigo!, identidade)

    if (estado.tela !== 'pergunta') throw new Error('esperava a pergunta')
    expect(
      estado.segmentos.every((s) => s === 'atual' || s === 'pendente')
    ).toBe(true)
    expect(JSON.stringify(estado)).not.toContain('correta')
  })

  it('depois de responder, o retorno diz se acertou — e só então', async () => {
    const { perguntas, identidade } = await corridaEmAndamento()

    const retorno = await registrarResposta(
      identidade,
      perguntas.primeira[0].id,
      'B'
    )

    expect(retorno.correta).toBe(true)
  })
})
