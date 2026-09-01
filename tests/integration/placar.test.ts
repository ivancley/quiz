import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { finalizarSessao } from '@/server/acoes'
import { placarDaSessao } from '@/server/placar'

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

/** Uma sessão com uma etapa e o número de perguntas pedido; gabarito sempre B. */
async function salaComPerguntas(quantas: number) {
  const quiz = await criarQuiz()
  const etapa = await criarEtapa(quiz.id)
  const perguntas = []
  for (let posicao = 1; posicao <= quantas; posicao += 1) {
    perguntas.push(await criarPergunta(etapa.id, posicao, 'B'))
  }
  const sessao = await criarSessao(quiz.id)
  return { quiz, etapa, perguntas, sessao }
}

async function entrarem(sessaoId: string, nomes: string[]) {
  const pessoas = []
  for (const nome of nomes) {
    pessoas.push(await criarParticipante(sessaoId, nome))
  }
  return pessoas
}

/** O placar como pares legíveis, para as asserções ficarem lendo o resultado. */
function resumo(placar: Awaited<ReturnType<typeof placarDaSessao>>) {
  return placar.map((linha) => [linha.nome, linha.total] as const)
}

describe('placar da sessão', () => {
  it('dá 4, 3, 2 e 1 aos quatro primeiros a acertar a mesma pergunta', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const pessoas = await entrarem(sessao.id, [
      'Marina',
      'Rafael',
      'Juliana',
      'Bruno',
    ])

    for (const pessoa of pessoas) {
      await criarResposta(pessoa.id, perguntas[0].id, 'B')
    }

    expect(resumo(await placarDaSessao(sessao.id))).toEqual([
      ['Marina', 4],
      ['Rafael', 3],
      ['Juliana', 2],
      ['Bruno', 1],
    ])
  })

  it('separa o ponto do acerto do bônus de velocidade', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const [marina, rafael] = await entrarem(sessao.id, ['Marina', 'Rafael'])

    await criarResposta(marina.id, perguntas[0].id, 'B')
    await criarResposta(rafael.id, perguntas[0].id, 'B')

    const placar = await placarDaSessao(sessao.id)

    expect(placar[0]).toMatchObject({ nome: 'Marina', acertos: 1, bonus: 3 })
    expect(placar[1]).toMatchObject({ nome: 'Rafael', acertos: 1, bonus: 2 })
  })

  it('não conta resposta errada, nem deixa que ela gaste lugar na fila', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const [errou, acertou] = await entrarem(sessao.id, ['Quem errou', 'Marina'])

    // Quem errou respondeu antes: se o erro consumisse posição, Marina seria a
    // segunda a acertar e ficaria com 3 em vez de 4.
    await criarResposta(errou.id, perguntas[0].id, 'A')
    await criarResposta(acertou.id, perguntas[0].id, 'B')

    expect(resumo(await placarDaSessao(sessao.id))).toEqual([
      ['Marina', 4],
      ['Quem errou', 0],
    ])
  })

  it('mantém no placar quem ainda não pontuou', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const [marina] = await entrarem(sessao.id, ['Marina', 'Ninguém respondeu'])

    await criarResposta(marina.id, perguntas[0].id, 'B')

    const placar = await placarDaSessao(sessao.id)

    expect(placar).toHaveLength(2)
    expect(placar[1]).toMatchObject({
      nome: 'Ninguém respondeu',
      acertos: 0,
      bonus: 0,
      total: 0,
    })
  })

  it('lista todo mundo mesmo sem nenhuma resposta ainda', async () => {
    const { sessao } = await salaComPerguntas(3)
    await entrarem(sessao.id, ['Marina', 'Rafael', 'Juliana'])

    const placar = await placarDaSessao(sessao.id)

    expect(placar.map((l) => l.total)).toEqual([0, 0, 0])
    expect(placar.map((l) => l.posicao)).toEqual([1, 2, 3])
  })

  it('conta o bônus por pergunta, e não uma vez pela sessão inteira', async () => {
    const { perguntas, sessao } = await salaComPerguntas(2)
    const [marina, rafael] = await entrarem(sessao.id, ['Marina', 'Rafael'])

    // Cada um chega primeiro em uma das perguntas.
    await criarResposta(marina.id, perguntas[0].id, 'B')
    await criarResposta(rafael.id, perguntas[0].id, 'B')
    await criarResposta(rafael.id, perguntas[1].id, 'B')
    await criarResposta(marina.id, perguntas[1].id, 'B')

    const placar = await placarDaSessao(sessao.id)

    // Um primeiro lugar (4) e um segundo (3) para cada.
    expect(placar.map((l) => l.total)).toEqual([7, 7])
  })

  it('ordena por total, desempatando por quem chegou lá primeiro', async () => {
    const { perguntas, sessao } = await salaComPerguntas(2)
    const [cedo, tarde] = await entrarem(sessao.id, ['Cedo', 'Tarde'])

    // Os dois terminam com 4 pontos: um primeiro lugar cada.
    await criarResposta(cedo.id, perguntas[0].id, 'B')
    await criarResposta(tarde.id, perguntas[1].id, 'B')

    const placar = await placarDaSessao(sessao.id)

    expect(placar.map((l) => l.total)).toEqual([4, 4])
    expect(placar[0].nome).toBe('Cedo')
  })

  it('numera as posições a partir da primeira', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const pessoas = await entrarem(sessao.id, ['Marina', 'Rafael', 'Juliana'])

    for (const pessoa of pessoas) {
      await criarResposta(pessoa.id, perguntas[0].id, 'B')
    }

    expect((await placarDaSessao(sessao.id)).map((l) => l.posicao)).toEqual([
      1, 2, 3,
    ])
  })
})

describe('isolamento entre sessões', () => {
  it('não deixa uma sessão consumir o bônus da outra', async () => {
    const quiz = await criarQuiz()
    const etapa = await criarEtapa(quiz.id)
    const pergunta = await criarPergunta(etapa.id, 1, 'B')

    // A mesma pergunta, rodada com duas turmas em horários diferentes — um quiz
    // só corre com uma turma por vez. A turma da tarde tem que recomeçar a fila
    // do bônus do zero, sem herdar nada da manhã.
    const manha = await criarSessao(quiz.id)
    const [naManha] = await entrarem(manha.id, ['Turma da manhã'])
    await criarResposta(naManha.id, pergunta.id, 'B')
    await finalizarSessao(manha.id)

    const tarde = await criarSessao(quiz.id)
    const [naTarde] = await entrarem(tarde.id, ['Turma da tarde'])
    await criarResposta(naTarde.id, pergunta.id, 'B')

    expect(resumo(await placarDaSessao(manha.id))).toEqual([
      ['Turma da manhã', 4],
    ])
    expect(resumo(await placarDaSessao(tarde.id))).toEqual([
      ['Turma da tarde', 4],
    ])
  })

  it('não mostra na sessão gente que está na outra', async () => {
    const quiz = await criarQuiz()
    const uma = await criarSessao(quiz.id)
    await entrarem(uma.id, ['Marina', 'Rafael'])
    await finalizarSessao(uma.id)

    const outra = await criarSessao(quiz.id)
    await entrarem(outra.id, ['Juliana'])

    expect(await placarDaSessao(uma.id)).toHaveLength(2)
    expect(await placarDaSessao(outra.id)).toHaveLength(1)
  })
})

describe('vinte respostas certas ao mesmo tempo', () => {
  it('distribui um bônus de 3, um de 2, um de 1 e nada para os demais', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const pessoas = await entrarem(
      sessao.id,
      Array.from({ length: 20 }, (_, i) => `Participante ${i + 1}`)
    )

    // Disparadas juntas, por conexões diferentes do pool: é o momento de maior
    // concorrência da dinâmica, todo mundo respondendo na mesma pergunta.
    await Promise.all(
      pessoas.map((pessoa) => criarResposta(pessoa.id, perguntas[0].id, 'B'))
    )

    const placar = await placarDaSessao(sessao.id)
    const totais = placar.map((linha) => linha.total).sort((a, b) => b - a)

    expect(totais).toEqual([4, 3, 2, ...Array.from({ length: 17 }, () => 1)])
  })

  it('não repete colocação nem com o relógio empatado no mesmo instante', async () => {
    const { perguntas, sessao } = await salaComPerguntas(1)
    const pessoas = await entrarem(
      sessao.id,
      Array.from({ length: 20 }, (_, i) => `Participante ${i + 1}`)
    )

    // O pior caso, forçado: as vinte respostas com o mesmo carimbo de tempo,
    // até o último dígito. Sobra só a chave sequencial para desempatar.
    const mesmoInstante = new Date('2026-09-01T13:00:00.000Z')
    await Promise.all(
      pessoas.map((pessoa) =>
        criarResposta(pessoa.id, perguntas[0].id, 'B', mesmoInstante)
      )
    )

    const placar = await placarDaSessao(sessao.id)
    const comBonus = placar.filter((linha) => linha.bonus > 0)

    expect(comBonus).toHaveLength(3)
    expect(comBonus.map((linha) => linha.bonus)).toEqual([3, 2, 1])

    // O que a chave sequencial garante não é que os bônus saiam distintos — a
    // função de janela já numera sem repetir. É que saiam sempre os *mesmos*:
    // com o critério de ordenação empatado, o banco poderia devolver uma ordem
    // diferente a cada consulta, e o placar projetado se reembaralharia sozinho
    // na frente da sala, sem ninguém ter respondido nada.
    for (let releitura = 0; releitura < 5; releitura += 1) {
      expect(await placarDaSessao(sessao.id)).toEqual(placar)
    }
  })
})
