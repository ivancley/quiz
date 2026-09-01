import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  abrirEtapa,
  encerrarEtapa,
  entrarNaCorrida,
  finalizarSessao,
  quizPorCodigo,
} from '@/server/acoes'
import type { Identidade } from '@/server/auth/participante'
import { estadoDoParticipante } from '@/server/estado'

import {
  criarEtapa,
  criarParticipante,
  criarPergunta,
  criarQuiz,
  criarResposta,
  criarSessao,
  fecharBanco,
  limparBanco,
} from '../helpers/banco'

beforeEach(limparBanco)
afterAll(fecharBanco)

/** Duas etapas de duas perguntas cada, com a sala aberta e ninguém dentro. */
async function salaMontada() {
  const quiz = await criarQuiz('Formação de Professores')
  const primeira = await criarEtapa(quiz.id, 1, 'Currículo em ação')
  const segunda = await criarEtapa(quiz.id, 2, 'Avaliação formativa')
  const perguntas = {
    primeira: [
      await criarPergunta(primeira.id, 1, 'B'),
      await criarPergunta(primeira.id, 2, 'B'),
    ],
    segunda: [
      await criarPergunta(segunda.id, 1, 'B'),
      await criarPergunta(segunda.id, 2, 'B'),
    ],
  }
  const sessao = await criarSessao(quiz.id)

  return { quiz, primeira, segunda, perguntas, sessao }
}

function identidadeDe(participanteId: string, sessaoId: string): Identidade {
  return { participanteId, sessaoId }
}

/** O estado que o celular daquela pessoa receberia agora. */
async function telaDe(codigo: string, identidade: Identidade | null) {
  const doCodigo = await quizPorCodigo(codigo)
  if (!doCodigo) throw new Error(`Quiz ${codigo} não existe`)
  return estadoDoParticipante(doCodigo, identidade)
}

describe('quem ainda não tem kart', () => {
  it('vê o aviso de sala fechada enquanto não há sessão', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    await criarEtapa(quiz.id, 1, 'Currículo em ação')

    const estado = await telaDe(quiz.codigo, null)

    expect(estado.tela).toBe('sem-sessao')
    expect(estado.quiz.titulo).toBe('Formação de Professores')
  })

  it('vê a porta de entrada quando a sala está aberta', async () => {
    const { quiz, sessao } = await salaMontada()
    await criarParticipante(sessao.id, 'Marina')

    const estado = await telaDe(quiz.codigo, null)

    expect(estado).toMatchObject({
      tela: 'entrada',
      sessaoId: sessao.id,
      naGrade: 1,
    })
  })

  it('conta as etapas e as perguntas do quiz no cabeçalho', async () => {
    const { quiz } = await salaMontada()

    const estado = await telaDe(quiz.codigo, null)

    expect(estado.quiz).toMatchObject({ etapas: 2, perguntas: 4 })
  })

  it('trata um cookie de outra sessão como quem ainda não entrou', async () => {
    const { quiz, sessao } = await salaMontada()
    const outroQuiz = await criarQuiz('Outro quiz')
    const outraSala = await criarSessao(outroQuiz.id)
    const alheio = await criarParticipante(outraSala.id, 'Rafael')

    const estado = await telaDe(
      quiz.codigo,
      identidadeDe(alheio.id, outraSala.id)
    )

    expect(estado).toMatchObject({ tela: 'entrada', sessaoId: sessao.id })
  })

  it('trata um cookie de participante inexistente como quem ainda não entrou', async () => {
    const { quiz, sessao } = await salaMontada()

    const estado = await telaDe(
      quiz.codigo,
      identidadeDe('00000000-0000-0000-0000-000000000000', sessao.id)
    )

    expect(estado.tela).toBe('entrada')
  })
})

describe('sala de espera', () => {
  it('recebe quem entrou antes de qualquer etapa abrir', async () => {
    const { quiz, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'espera',
      naGrade: 1,
      eu: { nome: 'Marina', numero: 1 },
      proxima: { posicao: 1, titulo: 'Currículo em ação' },
    })
  })

  it('numera o kart pela ordem de chegada na sala', async () => {
    const { quiz, sessao } = await salaMontada()
    await entrarNaCorrida(quiz.codigo, 'Marina')
    await entrarNaCorrida(quiz.codigo, 'Rafael')
    const { participante: juliana } = await entrarNaCorrida(
      quiz.codigo,
      'Juliana'
    )

    const estado = await telaDe(
      quiz.codigo,
      identidadeDe(juliana.id, sessao.id)
    )

    expect(estado).toMatchObject({ tela: 'espera', eu: { numero: 3 } })
  })

  it('devolve à espera quem chegou depois de a etapa ter encerrado', async () => {
    const { quiz, primeira, sessao } = await salaMontada()
    await entrarNaCorrida(quiz.codigo, 'Marina')
    await abrirEtapa(sessao.id, primeira.id)
    await encerrarEtapa(sessao.id)

    const { participante: atrasado } = await entrarNaCorrida(
      quiz.codigo,
      'Rafael'
    )
    const estado = await telaDe(
      quiz.codigo,
      identidadeDe(atrasado.id, sessao.id)
    )

    expect(estado).toMatchObject({
      tela: 'espera',
      proxima: { posicao: 2, titulo: 'Avaliação formativa' },
    })
  })
})

describe('tela de pergunta', () => {
  it('aparece assim que o organizador abre a etapa', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )

    await abrirEtapa(sessao.id, primeira.id)
    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'pergunta',
      etapa: { posicao: 1, titulo: 'Currículo em ação', perguntas: 2 },
      pergunta: { id: perguntas.primeira[0].id, posicao: 1 },
      segmentos: ['atual', 'pendente'],
      pontosNaEtapa: 0,
    })
  })

  it('entrega as quatro alternativas na ordem cadastrada', async () => {
    const { quiz, primeira, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    if (estado.tela !== 'pergunta') throw new Error('esperava a pergunta')
    expect(estado.pergunta.alternativas.map((a) => a.letra)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
    expect(estado.pergunta.alternativas[1].texto).toContain(
      'Aprendizagens e capacidades'
    )
  })

  it('avança para a pergunta seguinte depois de uma resposta', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'pergunta',
      pergunta: { id: perguntas.primeira[1].id, posicao: 2 },
      // Primeira a acertar: 1 ponto do acerto mais 3 de bônus.
      pontosNaEtapa: 4,
      segmentos: ['acertou', 'atual'],
    })
  })

  it('marca o erro no segmento da pergunta errada', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'A')

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'pergunta',
      pontosNaEtapa: 0,
      segmentos: ['errou', 'atual'],
    })
  })

  it('recebe quem entrou com a etapa já em andamento', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    await abrirEtapa(sessao.id, primeira.id)

    const { participante: atrasado } = await entrarNaCorrida(
      quiz.codigo,
      'Rafael'
    )
    const estado = await telaDe(
      quiz.codigo,
      identidadeDe(atrasado.id, sessao.id)
    )

    expect(estado).toMatchObject({
      tela: 'pergunta',
      pergunta: { id: perguntas.primeira[0].id },
      pontosNaEtapa: 0,
    })
  })
})

describe('resultado da etapa', () => {
  it('aparece quando o organizador encerra a etapa', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')
    await encerrarEtapa(sessao.id)

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'resultado-etapa',
      encerrada: true,
      pontosNaEtapa: 4,
      total: 4,
      posicao: 1,
      proxima: { posicao: 2 },
    })
  })

  it('aparece para quem terminou antes, com a etapa ainda correndo', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await entrarNaCorrida(quiz.codigo, 'Quem ainda está respondendo')
    await abrirEtapa(sessao.id, primeira.id)

    for (const pergunta of perguntas.primeira) {
      await criarResposta(marina.id, pergunta.id, 'B')
    }

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'resultado-etapa',
      encerrada: false,
      pontosNaEtapa: 8,
    })
  })

  it('detalha a volta pergunta a pergunta', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')
    await criarResposta(marina.id, perguntas.primeira[1].id, 'A')
    await encerrarEtapa(sessao.id)

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    if (estado.tela !== 'resultado-etapa') throw new Error('esperava resultado')
    expect(
      estado.volta.map((ponto) => [ponto.posicao, ponto.acertou, ponto.pontos])
    ).toEqual([
      [1, true, 4],
      [2, false, 0],
    ])
  })

  it('não dá pontos de etapas já encerradas a quem chegou depois', async () => {
    const { quiz, primeira, segunda, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    for (const pergunta of perguntas.primeira) {
      await criarResposta(marina.id, pergunta.id, 'B')
    }
    await encerrarEtapa(sessao.id)

    const { participante: atrasado } = await entrarNaCorrida(
      quiz.codigo,
      'Rafael'
    )
    await abrirEtapa(sessao.id, segunda.id)
    await criarResposta(atrasado.id, perguntas.segunda[0].id, 'B')
    await criarResposta(atrasado.id, perguntas.segunda[1].id, 'B')

    const estado = await telaDe(
      quiz.codigo,
      identidadeDe(atrasado.id, sessao.id)
    )

    expect(estado).toMatchObject({
      tela: 'resultado-etapa',
      pontosNaEtapa: 8,
      total: 8,
    })
  })
})

describe('depois da bandeirada final', () => {
  it('mostra o resultado final a quem estava na corrida', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')
    await finalizarSessao(sessao.id)

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({
      tela: 'final',
      total: 4,
      posicao: 1,
      naGrade: 1,
      eu: { nome: 'Marina' },
    })
  })

  it('devolve à entrada quem tem cookie de uma turma anterior', async () => {
    const { quiz, sessao } = await salaMontada()
    const { participante: marina } = await entrarNaCorrida(
      quiz.codigo,
      'Marina'
    )
    await finalizarSessao(sessao.id)
    const daTarde = await criarSessao(quiz.id)

    const estado = await telaDe(quiz.codigo, identidadeDe(marina.id, sessao.id))

    expect(estado).toMatchObject({ tela: 'entrada', sessaoId: daTarde.id })
  })

  it('avisa a sala fechada a quem nunca esteve na corrida', async () => {
    const { quiz, sessao } = await salaMontada()
    await finalizarSessao(sessao.id)

    expect((await telaDe(quiz.codigo, null)).tela).toBe('sem-sessao')
  })
})
