import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  alterarPergunta,
  buscarSessao,
  criarEtapa,
  criarPergunta,
  criarQuiz,
  excluirEtapa,
  excluirPergunta,
  excluirQuiz,
  finalizarSessao,
  iniciarSessao,
  listarEtapas,
  listarSessoes,
  moverEtapa,
  moverPergunta,
  numerosDaProjecao,
  renomearEtapa,
} from '@/server/acoes'
import { sessaoVivaDoQuiz } from '@/server/estado'
import { RecusaDeRegra } from '@/server/db/erros'

import { criarParticipante, fecharBanco, limparBanco } from '../helpers/banco'

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

describe('ciclo de vida da sessão', () => {
  it('começa aguardando a largada', async () => {
    const quiz = await criarQuiz('Formação de Professores')

    const aberta = await iniciarSessao(quiz.id)

    expect(aberta.status).toBe('aguardando')
    expect(aberta.finalizadaEm).toBeNull()
    expect(aberta.quizId).toBe(quiz.id)
  })

  it('recusa uma segunda sessão enquanto a primeira não terminar', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    await iniciarSessao(quiz.id)

    await expect(iniciarSessao(quiz.id)).rejects.toThrow(RecusaDeRegra)
  })

  it('abre a próxima assim que a anterior é encerrada', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const primeira = await iniciarSessao(quiz.id)

    await finalizarSessao(primeira.id)
    const segunda = await iniciarSessao(quiz.id)

    expect(segunda.id).not.toBe(primeira.id)
    expect((await buscarSessao(primeira.id))?.status).toBe('finalizada')
  })

  it('deixa dois quizzes rodarem ao mesmo tempo', async () => {
    const um = await criarQuiz('Um')
    const outro = await criarQuiz('Outro')

    await iniciarSessao(um.id)

    await expect(iniciarSessao(outro.id)).resolves.toBeTruthy()
  })

  it('marca a hora do encerramento e apaga a etapa que estava aberta', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const aberta = await iniciarSessao(quiz.id)

    const encerrada = await finalizarSessao(aberta.id)

    expect(encerrada.status).toBe('finalizada')
    expect(encerrada.finalizadaEm).toBeInstanceOf(Date)
    expect(encerrada.etapaAtualId).toBeNull()
    expect(encerrada.etapaStatus).toBeNull()
  })

  it('recusa encerrar duas vezes', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const aberta = await iniciarSessao(quiz.id)
    await finalizarSessao(aberta.id)

    await expect(finalizarSessao(aberta.id)).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa abrir sessão de um quiz que não existe', async () => {
    await expect(
      iniciarSessao('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('some da vista quando é encerrada, mas fica no histórico', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const aberta = await iniciarSessao(quiz.id)

    expect(await sessaoVivaDoQuiz(quiz.id)).not.toBeNull()

    await finalizarSessao(aberta.id)

    expect(await sessaoVivaDoQuiz(quiz.id)).toBeNull()
    expect(await listarSessoes(quiz.id)).toHaveLength(1)
  })

  it('lista as sessões da mais recente para a mais antiga, com quem entrou', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const primeira = await iniciarSessao(quiz.id)
    await criarParticipante(primeira.id, 'Marina')
    await criarParticipante(primeira.id, 'Rafael')
    await finalizarSessao(primeira.id)
    const segunda = await iniciarSessao(quiz.id)

    const historico = await listarSessoes(quiz.id)

    expect(historico.map((s) => s.id)).toEqual([segunda.id, primeira.id])
    expect(historico.map((s) => s.participantes)).toEqual([0, 2])
  })

  it('não mistura o histórico de quizzes diferentes', async () => {
    const um = await criarQuiz('Um')
    const outro = await criarQuiz('Outro')
    await iniciarSessao(um.id)

    expect(await listarSessoes(outro.id)).toHaveLength(0)
  })
})

describe('números da tela de projeção', () => {
  it('conta as etapas e as perguntas do quiz', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const primeira = await criarEtapa(quiz.id, 'Currículo em ação')
    await criarEtapa(quiz.id, 'Avaliação formativa')
    await criarPergunta(primeira.id, PERGUNTA)
    await criarPergunta(primeira.id, { ...PERGUNTA, texto: 'Outra' })

    const numeros = await numerosDaProjecao(quiz.id)

    expect(numeros.etapas).toBe(2)
    expect(numeros.perguntas).toBe(2)
  })

  it('conta quem já entrou na sessão viva', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const sessao = await iniciarSessao(quiz.id)
    await criarParticipante(sessao.id, 'Marina')
    await criarParticipante(sessao.id, 'Rafael')

    const numeros = await numerosDaProjecao(quiz.id)

    expect(numeros.salaAberta).toBe(true)
    expect(numeros.naGrade).toBe(2)
  })

  it('diz que a sala está aberta mesmo antes de alguém entrar', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    await iniciarSessao(quiz.id)

    const numeros = await numerosDaProjecao(quiz.id)

    expect(numeros.salaAberta).toBe(true)
    expect(numeros.naGrade).toBe(0)
  })

  it('não anuncia sala aberta sem sessão', async () => {
    const quiz = await criarQuiz('Formação de Professores')

    const numeros = await numerosDaProjecao(quiz.id)

    expect(numeros.salaAberta).toBe(false)
    expect(numeros.naGrade).toBe(0)
  })

  it('esquece a grade da turma anterior depois da bandeirada', async () => {
    const quiz = await criarQuiz('Formação de Professores')
    const manha = await iniciarSessao(quiz.id)
    await criarParticipante(manha.id, 'Turma da manhã')
    await finalizarSessao(manha.id)

    const numeros = await numerosDaProjecao(quiz.id)

    expect(numeros.salaAberta).toBe(false)
    expect(numeros.naGrade).toBe(0)
  })
})

describe('conteúdo do quiz durante uma sessão viva', () => {
  async function quizRodando() {
    const quiz = await criarQuiz('Formação de Professores')
    const etapa = await criarEtapa(quiz.id, 'Currículo em ação')
    const outraEtapa = await criarEtapa(quiz.id, 'Avaliação formativa')
    const pergunta = await criarPergunta(etapa.id, PERGUNTA)
    await criarPergunta(etapa.id, { ...PERGUNTA, texto: 'Segunda pergunta' })
    const sessao = await iniciarSessao(quiz.id)
    return { quiz, etapa, outraEtapa, pergunta, sessao }
  }

  it('recusa criar etapa', async () => {
    const { quiz } = await quizRodando()

    await expect(criarEtapa(quiz.id, 'Etapa nova')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa renomear etapa', async () => {
    const { etapa } = await quizRodando()

    await expect(renomearEtapa(etapa.id, 'Outro nome')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa excluir etapa', async () => {
    const { quiz, etapa } = await quizRodando()

    await expect(excluirEtapa(etapa.id)).rejects.toThrow(RecusaDeRegra)
    expect(await listarEtapas(quiz.id)).toHaveLength(2)
  })

  it('recusa reordenar etapa', async () => {
    const { etapa } = await quizRodando()

    await expect(moverEtapa(etapa.id, 'baixo')).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa criar pergunta', async () => {
    const { etapa } = await quizRodando()

    await expect(criarPergunta(etapa.id, PERGUNTA)).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa trocar o gabarito de uma pergunta', async () => {
    const { pergunta } = await quizRodando()

    await expect(
      alterarPergunta(pergunta.id, { ...PERGUNTA, correta: 'D' })
    ).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa excluir pergunta', async () => {
    const { pergunta } = await quizRodando()

    await expect(excluirPergunta(pergunta.id)).rejects.toThrow(RecusaDeRegra)
  })

  it('recusa reordenar pergunta', async () => {
    const { pergunta } = await quizRodando()

    await expect(moverPergunta(pergunta.id, 'baixo')).rejects.toThrow(
      RecusaDeRegra
    )
  })

  it('recusa excluir o quiz inteiro', async () => {
    const { quiz } = await quizRodando()

    await expect(excluirQuiz(quiz.id)).rejects.toThrow(RecusaDeRegra)
  })

  it('libera tudo de novo assim que a sessão é encerrada', async () => {
    const { quiz, etapa, pergunta, sessao } = await quizRodando()

    await finalizarSessao(sessao.id)

    await expect(renomearEtapa(etapa.id, 'Nome novo')).resolves.toBeTruthy()
    await expect(
      alterarPergunta(pergunta.id, { ...PERGUNTA, correta: 'D' })
    ).resolves.toBeTruthy()
    await expect(criarEtapa(quiz.id, 'Etapa nova')).resolves.toBeTruthy()
  })
})
