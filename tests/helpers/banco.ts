import { sql } from 'drizzle-orm'

import { db, pool } from '@/server/db/client'
import {
  etapa,
  participante,
  pergunta,
  quiz,
  resposta,
  sessao,
} from '@/server/db/schema'

export { db, pool }

/** Zera as tabelas entre casos, preservando a estrutura e as migrações. */
export async function limparBanco(): Promise<void> {
  await db.execute(
    sql`TRUNCATE resposta, participante, sessao, pergunta, etapa, quiz RESTART IDENTITY CASCADE`
  )
}

export async function fecharBanco(): Promise<void> {
  await pool.end()
}

let contadorDeCodigos = 0

export async function criarQuiz(titulo = 'Formação de Professores') {
  contadorDeCodigos += 1
  const [linha] = await db
    .insert(quiz)
    .values({ titulo, codigo: `teste${contadorDeCodigos}` })
    .returning()
  return linha
}

export async function criarEtapa(
  quizId: string,
  posicao = 1,
  titulo = 'Currículo em ação'
) {
  const [linha] = await db
    .insert(etapa)
    .values({ quizId, posicao, titulo })
    .returning()
  return linha
}

export async function criarPergunta(
  etapaId: string,
  posicao = 1,
  correta: 'A' | 'B' | 'C' | 'D' = 'B'
) {
  const [linha] = await db
    .insert(pergunta)
    .values({
      etapaId,
      posicao,
      texto: 'Na BNCC, o que as competências gerais descrevem?',
      altA: 'Conteúdos obrigatórios por bimestre',
      altB: 'Aprendizagens e capacidades para toda a educação básica',
      altC: 'Critérios de avaliação externa',
      altD: 'A lista de livros do PNLD',
      correta,
    })
    .returning()
  return linha
}

export async function criarSessao(quizId: string) {
  const [linha] = await db.insert(sessao).values({ quizId }).returning()
  return linha
}

export async function criarParticipante(sessaoId: string, nome: string) {
  const [linha] = await db
    .insert(participante)
    .values({ sessaoId, nome })
    .returning()
  return linha
}

export async function criarResposta(
  participanteId: string,
  perguntaId: string,
  escolhida: 'A' | 'B' | 'C' | 'D'
) {
  const [linha] = await db
    .insert(resposta)
    .values({ participanteId, perguntaId, escolhida })
    .returning()
  return linha
}
