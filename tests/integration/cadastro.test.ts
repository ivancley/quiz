import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  buscarQuiz,
  criarEtapa,
  criarQuiz,
  excluirEtapa,
  excluirQuiz,
  listarEtapas,
  listarQuizzes,
  moverEtapa,
  renomearEtapa,
  renomearQuiz,
} from '@/server/acoes'
import { RecusaDeRegra } from '@/server/db/erros'

import { criarPergunta, fecharBanco, limparBanco } from '../helpers/banco'

beforeEach(limparBanco)
afterAll(fecharBanco)

/** Os títulos das etapas na ordem em que aparecem no quiz. */
async function ordemDe(quizId: string) {
  const etapas = await listarEtapas(quizId)
  return etapas.map((e) => e.titulo)
}

describe('quiz', () => {
  it('nasce com um código de entrada próprio', async () => {
    const criado = await criarQuiz('Formação de Professores')

    expect(criado.titulo).toBe('Formação de Professores')
    expect(criado.codigo).toMatch(/^[A-Z2-9]{6}$/)
  })

  it('sorteia códigos diferentes para quizzes diferentes', async () => {
    const codigos = new Set<string>()
    for (let i = 0; i < 20; i += 1) {
      codigos.add((await criarQuiz(`Quiz ${i}`)).codigo)
    }

    expect(codigos.size).toBe(20)
  })

  it('não usa letras e números que se confundem no telão', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await criarQuiz(`Quiz ${i}`)).codigo).not.toMatch(/[OIL01]/)
    }
  })

  it('recusa título vazio', async () => {
    await expect(criarQuiz('   ')).rejects.toThrow(RecusaDeRegra)
  })

  it('é renomeado sem perder o código de entrada', async () => {
    const criado = await criarQuiz('Nome provisório')
    const alterado = await renomearQuiz(criado.id, '  BNCC na prática  ')

    expect(alterado.titulo).toBe('BNCC na prática')
    expect(alterado.codigo).toBe(criado.codigo)
  })

  it('recusa renomear um quiz que não existe', async () => {
    await expect(
      renomearQuiz('00000000-0000-0000-0000-000000000000', 'Qualquer')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('é listado com a contagem de etapas e de perguntas', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(criado.id, 'Currículo em ação')
    await criarEtapa(criado.id, 'Avaliação formativa')
    await criarPergunta(primeira.id, 1)
    await criarPergunta(primeira.id, 2)

    const [listado] = await listarQuizzes()

    expect(listado.titulo).toBe('Formação de Professores')
    expect(listado.etapas).toBe(2)
    expect(listado.perguntas).toBe(2)
  })

  it('aparece na listagem mesmo sem nenhuma etapa', async () => {
    await criarQuiz('Recém-criado')

    const [listado] = await listarQuizzes()

    expect(listado.etapas).toBe(0)
    expect(listado.perguntas).toBe(0)
  })

  it('leva as etapas junto ao ser excluído', async () => {
    const criado = await criarQuiz('Descartável')
    await criarEtapa(criado.id, 'Etapa única')

    await excluirQuiz(criado.id)

    expect(await buscarQuiz(criado.id)).toBeNull()
    expect(await listarEtapas(criado.id)).toHaveLength(0)
  })
})

describe('etapas', () => {
  it('entram na fila, uma depois da outra', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    await criarEtapa(criado.id, 'Segunda')
    await criarEtapa(criado.id, 'Terceira')

    const etapas = await listarEtapas(criado.id)

    expect(etapas.map((e) => [e.titulo, e.posicao])).toEqual([
      ['Primeira', 1],
      ['Segunda', 2],
      ['Terceira', 3],
    ])
  })

  it('não misturam a numeração de quizzes diferentes', async () => {
    const um = await criarQuiz('Um')
    const outro = await criarQuiz('Outro')
    await criarEtapa(um.id, 'Etapa do primeiro')
    const doOutro = await criarEtapa(outro.id, 'Etapa do segundo')

    expect(doOutro.posicao).toBe(1)
  })

  it('são renomeadas sem mudar de lugar', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    const segunda = await criarEtapa(criado.id, 'Segunda')

    const alterada = await renomearEtapa(segunda.id, 'Avaliação formativa')

    expect(alterada.posicao).toBe(2)
    expect(await ordemDe(criado.id)).toEqual([
      'Primeira',
      'Avaliação formativa',
    ])
  })

  it('sobem de posição trocando com a anterior', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    await criarEtapa(criado.id, 'Segunda')
    const terceira = await criarEtapa(criado.id, 'Terceira')

    await moverEtapa(terceira.id, 'cima')

    expect(await ordemDe(criado.id)).toEqual([
      'Primeira',
      'Terceira',
      'Segunda',
    ])
  })

  it('descem de posição trocando com a seguinte', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(criado.id, 'Primeira')
    await criarEtapa(criado.id, 'Segunda')
    await criarEtapa(criado.id, 'Terceira')

    await moverEtapa(primeira.id, 'baixo')

    expect(await ordemDe(criado.id)).toEqual([
      'Segunda',
      'Primeira',
      'Terceira',
    ])
  })

  it('sobrevivem a uma sequência de trocas sem duplicar posição', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(criado.id, 'Primeira')
    const segunda = await criarEtapa(criado.id, 'Segunda')
    const terceira = await criarEtapa(criado.id, 'Terceira')

    // Quatro trocas que se desfazem: a ordem final é a inicial, e é aí que uma
    // posição duplicada ou um buraco apareceria.
    await moverEtapa(primeira.id, 'baixo')
    await moverEtapa(terceira.id, 'cima')
    await moverEtapa(primeira.id, 'cima')
    await moverEtapa(segunda.id, 'baixo')

    const etapas = await listarEtapas(criado.id)

    expect(etapas.map((e) => e.posicao)).toEqual([1, 2, 3])
    expect(await ordemDe(criado.id)).toEqual([
      'Primeira',
      'Segunda',
      'Terceira',
    ])
  })

  it('recusam subir quando já são a primeira', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(criado.id, 'Primeira')
    await criarEtapa(criado.id, 'Segunda')

    await expect(moverEtapa(primeira.id, 'cima')).rejects.toThrow(RecusaDeRegra)
    expect(await ordemDe(criado.id)).toEqual(['Primeira', 'Segunda'])
  })

  it('recusam descer quando já são a última', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    const segunda = await criarEtapa(criado.id, 'Segunda')

    await expect(moverEtapa(segunda.id, 'baixo')).rejects.toThrow(RecusaDeRegra)
    expect(await ordemDe(criado.id)).toEqual(['Primeira', 'Segunda'])
  })

  it('fecham o buraco de posição deixado pela etapa excluída', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    const segunda = await criarEtapa(criado.id, 'Segunda')
    await criarEtapa(criado.id, 'Terceira')

    await excluirEtapa(segunda.id)

    const etapas = await listarEtapas(criado.id)
    expect(etapas.map((e) => [e.titulo, e.posicao])).toEqual([
      ['Primeira', 1],
      ['Terceira', 2],
    ])
  })

  it('deixam a próxima etapa criada logo depois da última, sem pular número', async () => {
    const criado = await criarQuiz('Formação de Professores')
    await criarEtapa(criado.id, 'Primeira')
    const segunda = await criarEtapa(criado.id, 'Segunda')
    await excluirEtapa(segunda.id)

    const nova = await criarEtapa(criado.id, 'Nova')

    expect(nova.posicao).toBe(2)
  })

  it('levam as perguntas junto ao serem excluídas', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const unica = await criarEtapa(criado.id, 'Etapa única')
    await criarPergunta(unica.id, 1)

    await excluirEtapa(unica.id)

    const [listado] = await listarQuizzes()
    expect(listado.perguntas).toBe(0)
  })

  it('são listadas com a contagem de perguntas de cada uma', async () => {
    const criado = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(criado.id, 'Primeira')
    await criarEtapa(criado.id, 'Segunda')
    await criarPergunta(primeira.id, 1)
    await criarPergunta(primeira.id, 2)

    const etapas = await listarEtapas(criado.id)

    expect(etapas.map((e) => e.perguntas)).toEqual([2, 0])
  })

  it('recusam título vazio', async () => {
    const criado = await criarQuiz('Formação de Professores')

    await expect(criarEtapa(criado.id, '  ')).rejects.toThrow(RecusaDeRegra)
  })
})
