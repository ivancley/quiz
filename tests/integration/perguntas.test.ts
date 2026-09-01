import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  alterarPergunta,
  criarEtapa,
  criarPergunta,
  criarQuiz,
  excluirPergunta,
  listarPerguntas,
  moverPergunta,
} from '@/server/acoes'
import { RecusaDeRegra } from '@/server/db/erros'

import { fecharBanco, limparBanco } from '../helpers/banco'

beforeEach(limparBanco)
afterAll(fecharBanco)

const PERGUNTA = {
  texto: 'Na BNCC, o que as competências gerais descrevem?',
  altA: 'Conteúdos obrigatórios por bimestre',
  altB: 'Aprendizagens e capacidades para toda a educação básica',
  altC: 'Critérios de avaliação externa',
  altD: 'A lista de livros do PNLD',
  correta: 'B',
}

async function etapaNova() {
  const criado = await criarQuiz('Formação de Professores')
  return criarEtapa(criado.id, 'Currículo em ação')
}

/** Os enunciados na ordem em que aparecem na etapa. */
async function ordemDe(etapaId: string) {
  const perguntas = await listarPerguntas(etapaId)
  return perguntas.map((p) => p.texto)
}

describe('cadastro de pergunta', () => {
  it('guarda o enunciado, as quatro alternativas e o gabarito', async () => {
    const etapa = await etapaNova()

    const criada = await criarPergunta(etapa.id, PERGUNTA)

    expect(criada.texto).toBe(PERGUNTA.texto)
    expect([criada.altA, criada.altB, criada.altC, criada.altD]).toEqual([
      PERGUNTA.altA,
      PERGUNTA.altB,
      PERGUNTA.altC,
      PERGUNTA.altD,
    ])
    expect(criada.correta).toBe('B')
    expect(criada.posicao).toBe(1)
  })

  it('apara os espaços em volta do enunciado e das alternativas', async () => {
    const etapa = await etapaNova()

    const criada = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: '  Enunciado com sobras  ',
      altA: '  Primeira  ',
    })

    expect(criada.texto).toBe('Enunciado com sobras')
    expect(criada.altA).toBe('Primeira')
  })

  it('recusa alternativa em branco', async () => {
    const etapa = await etapaNova()

    await expect(
      criarPergunta(etapa.id, { ...PERGUNTA, altC: '   ' })
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa alternativa ausente', async () => {
    const etapa = await etapaNova()
    const { altD: _semD, ...incompleta } = PERGUNTA

    await expect(criarPergunta(etapa.id, incompleta)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa gabarito ausente', async () => {
    const etapa = await etapaNova()
    const { correta: _semGabarito, ...semCorreta } = PERGUNTA

    await expect(criarPergunta(etapa.id, semCorreta)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa gabarito que não é uma das quatro letras', async () => {
    const etapa = await etapaNova()

    await expect(
      criarPergunta(etapa.id, { ...PERGUNTA, correta: 'E' })
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa enunciado em branco', async () => {
    const etapa = await etapaNova()

    await expect(
      criarPergunta(etapa.id, { ...PERGUNTA, texto: '  ' })
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('não deixa a pergunta recusada no banco', async () => {
    const etapa = await etapaNova()

    await expect(
      criarPergunta(etapa.id, { ...PERGUNTA, altA: '' })
    ).rejects.toThrow(RecusaDeRegra)

    expect(await listarPerguntas(etapa.id)).toHaveLength(0)
  })
})

describe('perguntas dentro da etapa', () => {
  it('entram na fila, uma depois da outra', async () => {
    const etapa = await etapaNova()
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Primeira' })
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Segunda' })
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Terceira' })

    const perguntas = await listarPerguntas(etapa.id)

    expect(perguntas.map((p) => [p.texto, p.posicao])).toEqual([
      ['Primeira', 1],
      ['Segunda', 2],
      ['Terceira', 3],
    ])
  })

  it('não misturam a numeração de etapas diferentes', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const uma = await criarEtapa(criado.id, 'Primeira etapa')
    const outra = await criarEtapa(criado.id, 'Segunda etapa')
    await criarPergunta(uma.id, PERGUNTA)

    const daOutra = await criarPergunta(outra.id, PERGUNTA)

    expect(daOutra.posicao).toBe(1)
  })

  it('são reescritas por inteiro sem mudar de lugar', async () => {
    const etapa = await etapaNova()
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Primeira' })
    const segunda = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: 'Segunda',
    })

    const alterada = await alterarPergunta(segunda.id, {
      ...PERGUNTA,
      texto: 'Segunda, corrigida',
      correta: 'D',
    })

    expect(alterada.texto).toBe('Segunda, corrigida')
    expect(alterada.correta).toBe('D')
    expect(alterada.posicao).toBe(2)
  })

  it('recusam alteração que deixaria uma alternativa vazia', async () => {
    const etapa = await etapaNova()
    const criada = await criarPergunta(etapa.id, PERGUNTA)

    await expect(
      alterarPergunta(criada.id, { ...PERGUNTA, altB: '' })
    ).rejects.toThrow(RecusaDeRegra)

    const [inalterada] = await listarPerguntas(etapa.id)
    expect(inalterada.altB).toBe(PERGUNTA.altB)
  })

  it('sobem e descem de posição', async () => {
    const etapa = await etapaNova()
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Primeira' })
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Segunda' })
    const terceira = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: 'Terceira',
    })

    await moverPergunta(terceira.id, 'cima')
    expect(await ordemDe(etapa.id)).toEqual(['Primeira', 'Terceira', 'Segunda'])

    await moverPergunta(terceira.id, 'baixo')
    expect(await ordemDe(etapa.id)).toEqual(['Primeira', 'Segunda', 'Terceira'])
  })

  it('recusam sair pelas pontas da fila', async () => {
    const etapa = await etapaNova()
    const primeira = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: 'Primeira',
    })
    const segunda = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: 'Segunda',
    })

    await expect(moverPergunta(primeira.id, 'cima')).rejects.toThrow(
      RecusaDeRegra
    )
    await expect(moverPergunta(segunda.id, 'baixo')).rejects.toThrow(
      RecusaDeRegra
    )
    expect(await ordemDe(etapa.id)).toEqual(['Primeira', 'Segunda'])
  })

  it('fecham o buraco de posição deixado pela pergunta excluída', async () => {
    const etapa = await etapaNova()
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Primeira' })
    const segunda = await criarPergunta(etapa.id, {
      ...PERGUNTA,
      texto: 'Segunda',
    })
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Terceira' })

    await excluirPergunta(segunda.id)

    const perguntas = await listarPerguntas(etapa.id)
    expect(perguntas.map((p) => [p.texto, p.posicao])).toEqual([
      ['Primeira', 1],
      ['Terceira', 2],
    ])
  })

  it('recusam excluir uma pergunta que não existe', async () => {
    await expect(
      excluirPergunta('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(RecusaDeRegra)
  })
})
