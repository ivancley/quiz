import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  abrirEtapa,
  encerrarEtapa,
  encerrarEtapaSeCompleta,
  finalizarSessao,
} from '@/server/acoes'
import { RecusaDeRegra } from '@/server/db/erros'
import { estadoDoPainel } from '@/server/estado'

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

/** Um quiz com duas etapas de duas perguntas cada, e uma sessão aberta. */
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

describe('estado do painel', () => {
  it('não existe para uma sessão que não existe', async () => {
    expect(
      await estadoDoPainel('00000000-0000-0000-0000-000000000000')
    ).toBeNull()
  })

  it('traz o quiz, as etapas e a sessão vazia antes de qualquer coisa acontecer', async () => {
    const { quiz, sessao } = await salaMontada()

    const estado = await estadoDoPainel(sessao.id)

    expect(estado?.quiz).toMatchObject({ id: quiz.id, titulo: quiz.titulo })
    expect(estado?.sessao).toMatchObject({
      status: 'aguardando',
      etapaAtualId: null,
      etapaStatus: null,
    })
    expect(estado?.etapas.map((e) => [e.titulo, e.perguntas])).toEqual([
      ['Currículo em ação', 2],
      ['Avaliação formativa', 2],
    ])
    expect(estado?.participantes).toEqual([])
    expect(estado?.progresso).toEqual([])
  })

  it('numera os karts pela ordem de chegada', async () => {
    const { sessao } = await salaMontada()
    await criarParticipante(sessao.id, 'Marina')
    await criarParticipante(sessao.id, 'Rafael')
    await criarParticipante(sessao.id, 'Juliana')

    const estado = await estadoDoPainel(sessao.id)

    expect(estado?.participantes.map((p) => [p.nome, p.numero])).toEqual([
      ['Marina', 1],
      ['Rafael', 2],
      ['Juliana', 3],
    ])
  })

  it('mostra quantos já responderam cada pergunta da etapa aberta', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    const rafael = await criarParticipante(sessao.id, 'Rafael')
    await abrirEtapa(sessao.id, primeira.id)

    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')
    await criarResposta(rafael.id, perguntas.primeira[0].id, 'A')
    await criarResposta(marina.id, perguntas.primeira[1].id, 'B')

    const estado = await estadoDoPainel(sessao.id)

    // Erradas contam como respondidas: o progresso mede quem já jogou, não
    // quem acertou.
    expect(estado?.progresso.map((p) => [p.posicao, p.respondidas])).toEqual([
      [1, 2],
      [2, 1],
    ])
  })

  it('não conta no progresso as respostas de outra turma à mesma pergunta', async () => {
    const { quiz, primeira, perguntas, sessao } = await salaMontada()
    const daManha = await criarParticipante(sessao.id, 'Turma da manhã')
    await criarResposta(daManha.id, perguntas.primeira[0].id, 'B')
    await finalizarSessao(sessao.id)

    const daTarde = await criarSessao(quiz.id)
    await criarParticipante(daTarde.id, 'Turma da tarde')
    await abrirEtapa(daTarde.id, primeira.id)

    const estado = await estadoDoPainel(daTarde.id)

    expect(estado?.progresso.map((p) => p.respondidas)).toEqual([0, 0])
  })

  it('traz o placar já ordenado, com quem ainda não pontuou', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    const rafael = await criarParticipante(sessao.id, 'Rafael')
    await criarParticipante(sessao.id, 'Juliana')
    await abrirEtapa(sessao.id, primeira.id)

    await criarResposta(rafael.id, perguntas.primeira[0].id, 'B')
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')
    await criarResposta(marina.id, perguntas.primeira[1].id, 'B')

    const estado = await estadoDoPainel(sessao.id)

    expect(estado?.placar.map((l) => [l.nome, l.total])).toEqual([
      ['Marina', 7],
      ['Rafael', 4],
      ['Juliana', 0],
    ])
  })
})

describe('condução das etapas', () => {
  it('abrir a etapa põe a sessão em andamento', async () => {
    const { primeira, sessao } = await salaMontada()

    await abrirEtapa(sessao.id, primeira.id)

    expect((await estadoDoPainel(sessao.id))?.sessao).toMatchObject({
      status: 'em_andamento',
      etapaAtualId: primeira.id,
      etapaStatus: 'aberta',
    })
  })

  it('recusa abrir uma segunda etapa com uma já aberta', async () => {
    const { primeira, segunda, sessao } = await salaMontada()
    await abrirEtapa(sessao.id, primeira.id)

    await expect(abrirEtapa(sessao.id, segunda.id)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('deixa avançar para a próxima etapa depois de encerrar a anterior', async () => {
    const { primeira, segunda, sessao } = await salaMontada()
    await abrirEtapa(sessao.id, primeira.id)
    await encerrarEtapa(sessao.id)

    await abrirEtapa(sessao.id, segunda.id)

    expect((await estadoDoPainel(sessao.id))?.sessao).toMatchObject({
      etapaAtualId: segunda.id,
      etapaStatus: 'aberta',
    })
  })

  it('recusa abrir etapa de outro quiz', async () => {
    const { sessao } = await salaMontada()
    const outroQuiz = await criarQuiz('Outro quiz')
    const doOutro = await criarEtapa(outroQuiz.id, 1, 'Etapa alheia')
    await criarPergunta(doOutro.id, 1, 'B')

    await expect(abrirEtapa(sessao.id, doOutro.id)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa abrir etapa sem perguntas', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const vazia = await criarEtapa(quiz.id, 1, 'Etapa vazia')
    const sessao = await criarSessao(quiz.id)

    await expect(abrirEtapa(sessao.id, vazia.id)).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa abrir etapa em sessão já encerrada', async () => {
    const { primeira, sessao } = await salaMontada()
    await finalizarSessao(sessao.id)

    await expect(abrirEtapa(sessao.id, primeira.id)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa encerrar quando não há etapa aberta', async () => {
    const { sessao } = await salaMontada()

    await expect(encerrarEtapa(sessao.id)).rejects.toThrow(RecusaDeRegra)
  })
})

describe('encerramento automático da etapa', () => {
  it('encerra sozinha quando todo mundo respondeu tudo', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    const rafael = await criarParticipante(sessao.id, 'Rafael')
    await abrirEtapa(sessao.id, primeira.id)

    for (const pessoa of [marina, rafael]) {
      for (const pergunta of perguntas.primeira) {
        await criarResposta(pessoa.id, pergunta.id, 'B')
      }
    }

    expect(await encerrarEtapaSeCompleta(sessao.id)).toBe(true)
    expect((await estadoDoPainel(sessao.id))?.sessao.etapaStatus).toBe(
      'encerrada'
    )
  })

  it('continua aberta enquanto faltar uma resposta', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    const rafael = await criarParticipante(sessao.id, 'Rafael')
    await abrirEtapa(sessao.id, primeira.id)

    for (const pergunta of perguntas.primeira) {
      await criarResposta(marina.id, pergunta.id, 'B')
    }
    await criarResposta(rafael.id, perguntas.primeira[0].id, 'B')

    expect(await encerrarEtapaSeCompleta(sessao.id)).toBe(false)
    expect((await estadoDoPainel(sessao.id))?.sessao.etapaStatus).toBe('aberta')
  })

  it('não fecha a etapa antes de a primeira pessoa entrar', async () => {
    const { primeira, sessao } = await salaMontada()
    await abrirEtapa(sessao.id, primeira.id)

    expect(await encerrarEtapaSeCompleta(sessao.id)).toBe(false)
  })

  it('não confunde respostas de outra etapa com as desta', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    await abrirEtapa(sessao.id, primeira.id)

    // Responde as duas da segunda etapa, nenhuma da que está aberta.
    for (const pergunta of perguntas.segunda) {
      await criarResposta(marina.id, pergunta.id, 'B')
    }

    expect(await encerrarEtapaSeCompleta(sessao.id)).toBe(false)
  })

  it('o organizador encerra na mão mesmo faltando resposta', async () => {
    const { primeira, perguntas, sessao } = await salaMontada()
    const marina = await criarParticipante(sessao.id, 'Marina')
    await criarParticipante(sessao.id, 'Quem não respondeu')
    await abrirEtapa(sessao.id, primeira.id)
    await criarResposta(marina.id, perguntas.primeira[0].id, 'B')

    await encerrarEtapa(sessao.id)

    expect((await estadoDoPainel(sessao.id))?.sessao.etapaStatus).toBe(
      'encerrada'
    )
  })

  it('não tenta encerrar quando a etapa já está encerrada', async () => {
    const { primeira, sessao } = await salaMontada()
    await abrirEtapa(sessao.id, primeira.id)
    await encerrarEtapa(sessao.id)

    expect(await encerrarEtapaSeCompleta(sessao.id)).toBe(false)
  })
})
