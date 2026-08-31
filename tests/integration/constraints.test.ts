import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { constraintViolada } from '@/server/db/erros'
import { sessao } from '@/server/db/schema'

import {
  criarEtapa,
  criarParticipante,
  criarPergunta,
  criarQuiz,
  criarResposta,
  criarSessao,
  db,
  fecharBanco,
  limparBanco,
} from '../helpers/banco'

/** Executa a operação e devolve o nome da constraint que ela violou. */
async function constraintDe(
  operacao: () => Promise<unknown>
): Promise<string | null> {
  try {
    await operacao()
  } catch (erro) {
    return constraintViolada(erro)
  }
  throw new Error('A operação foi aceita, mas deveria ter sido recusada.')
}

beforeEach(limparBanco)
afterAll(fecharBanco)

describe('uma sessão ativa por quiz', () => {
  it('recusa abrir uma segunda sessão enquanto a primeira não termina', async () => {
    const q = await criarQuiz()
    await criarSessao(q.id)

    await expect(constraintDe(() => criarSessao(q.id))).resolves.toBe(
      'sessao_ativa_unica'
    )
  })

  it('libera uma nova sessão depois que a anterior é finalizada', async () => {
    const q = await criarQuiz()
    const primeira = await criarSessao(q.id)

    await db
      .update(sessao)
      .set({ status: 'finalizada', finalizadaEm: new Date() })
      .where(sql`id = ${primeira.id}`)

    const segunda = await criarSessao(q.id)
    expect(segunda.id).not.toBe(primeira.id)
  })

  it('permite sessões simultâneas em quizzes diferentes', async () => {
    const a = await criarQuiz('Quiz A')
    const b = await criarQuiz('Quiz B')

    await criarSessao(a.id)
    await expect(criarSessao(b.id)).resolves.toBeDefined()
  })
})

describe('nome do participante único na sessão', () => {
  it('recusa dois participantes com o mesmo nome na mesma sessão', async () => {
    const q = await criarQuiz()
    const s = await criarSessao(q.id)
    await criarParticipante(s.id, 'Marina Alves')

    await expect(
      constraintDe(() => criarParticipante(s.id, 'Marina Alves'))
    ).resolves.toBe('participante_nome_unico')
  })

  it('recusa também quando só muda a caixa das letras', async () => {
    const q = await criarQuiz()
    const s = await criarSessao(q.id)
    await criarParticipante(s.id, 'Marina Alves')

    await expect(
      constraintDe(() => criarParticipante(s.id, 'MARINA ALVES'))
    ).resolves.toBe('participante_nome_unico')
  })

  it('permite o mesmo nome em sessões diferentes', async () => {
    const a = await criarQuiz('Quiz A')
    const b = await criarQuiz('Quiz B')
    const sa = await criarSessao(a.id)
    const sb = await criarSessao(b.id)

    await criarParticipante(sa.id, 'Marina Alves')
    await expect(
      criarParticipante(sb.id, 'Marina Alves')
    ).resolves.toBeDefined()
  })
})

describe('uma resposta por participante por pergunta', () => {
  it('recusa a segunda resposta para a mesma pergunta', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)
    const p = await criarPergunta(e.id)
    const s = await criarSessao(q.id)
    const marina = await criarParticipante(s.id, 'Marina Alves')

    await criarResposta(marina.id, p.id, 'B')

    await expect(
      constraintDe(() => criarResposta(marina.id, p.id, 'C'))
    ).resolves.toBe('resposta_unica_por_pergunta')
  })

  it('permite que participantes diferentes respondam a mesma pergunta', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)
    const p = await criarPergunta(e.id)
    const s = await criarSessao(q.id)
    const marina = await criarParticipante(s.id, 'Marina Alves')
    const rafael = await criarParticipante(s.id, 'Rafael Costa')

    await criarResposta(marina.id, p.id, 'B')
    await expect(criarResposta(rafael.id, p.id, 'B')).resolves.toBeDefined()
  })
})

describe('forma da pergunta e da resposta', () => {
  it('recusa gabarito fora das quatro alternativas existentes', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)

    await expect(
      constraintDe(() =>
        db.execute(sql`
        INSERT INTO pergunta (etapa_id, posicao, texto, alt_a, alt_b, alt_c, alt_d, correta)
        VALUES (${e.id}, 1, 'Pergunta', 'A', 'B', 'C', 'D', 'E')
      `)
      )
    ).resolves.toBe('pergunta_correta_valida')
  })

  it('recusa pergunta sem uma das quatro alternativas', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)

    await expect(
      constraintDe(() =>
        db.execute(sql`
        INSERT INTO pergunta (etapa_id, posicao, texto, alt_a, alt_b, alt_c, correta)
        VALUES (${e.id}, 1, 'Pergunta', 'A', 'B', 'C', 'B')
      `)
      )
    ).resolves.toBe('alt_d')
  })

  it('recusa resposta com letra fora das quatro alternativas', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)
    const p = await criarPergunta(e.id)
    const s = await criarSessao(q.id)
    const marina = await criarParticipante(s.id, 'Marina Alves')

    await expect(
      constraintDe(() =>
        db.execute(sql`
        INSERT INTO resposta (participante_id, pergunta_id, escolhida)
        VALUES (${marina.id}, ${p.id}, 'E')
      `)
      )
    ).resolves.toBe('resposta_escolhida_valida')
  })
})

describe('instante da resposta medido pelo servidor', () => {
  it('distingue respostas registradas em sequência imediata', async () => {
    const q = await criarQuiz()
    const e = await criarEtapa(q.id)
    const p = await criarPergunta(e.id)
    const s = await criarSessao(q.id)
    const marina = await criarParticipante(s.id, 'Marina Alves')
    const rafael = await criarParticipante(s.id, 'Rafael Costa')

    const primeira = await criarResposta(marina.id, p.id, 'B')
    const segunda = await criarResposta(rafael.id, p.id, 'B')

    // A chave sequencial é o desempate quando o relógio não separa as duas.
    expect(segunda.id).toBeGreaterThan(primeira.id)
    expect(segunda.respondidaEm.getTime()).toBeGreaterThanOrEqual(
      primeira.respondidaEm.getTime()
    )
  })
})
