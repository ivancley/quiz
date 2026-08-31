/**
 * Acesso direto ao banco da bateria, para semear o cenário de cada teste
 * e para conferir no banco aquilo que a tela não mostra.
 *
 * Pool próprio, e não o `@/server/db/client`: este código roda no processo do
 * Playwright, enquanto a aplicação sob teste roda em outro processo. São duas
 * conexões distintas para o mesmo banco, de propósito — é assim que se observa
 * o que a aplicação de fato gravou.
 */
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from '../../../src/server/db/schema'

const { etapa, participante, pergunta, quiz, resposta, sessao } = schema

export type Letra = schema.Letra

function urlDoBanco(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL não está definida. A bateria é iniciada por playwright.config.ts, que carrega .env.e2e.'
    )
  }
  if (!url.endsWith('_e2e')) {
    // Um spec chega a apagar tabelas inteiras; apontado para o banco errado,
    // levaria junto o trabalho de desenvolvimento.
    throw new Error(`A bateria recusa rodar fora de um banco _e2e: ${url}`)
  }
  return url
}

export const pool = new Pool({ connectionString: urlDoBanco(), max: 5 })
export const db = drizzle(pool, { schema })

/** Zera as tabelas entre casos, preservando a estrutura e as migrações. */
export async function limparBanco(): Promise<void> {
  await db.execute(
    sql`TRUNCATE resposta, participante, sessao, pergunta, etapa, quiz RESTART IDENTITY CASCADE`
  )
}

export async function fecharBanco(): Promise<void> {
  await pool.end()
}

type Alternativas = { a: string; b: string; c: string; d: string }

const ALTERNATIVAS_PADRAO: Alternativas = {
  a: 'Conteúdos obrigatórios por bimestre',
  b: 'Aprendizagens e capacidades para toda a educação básica',
  c: 'Critérios de avaliação externa',
  d: 'A lista de livros do PNLD',
}

export type Roteiro = {
  titulo?: string
  codigo?: string
  etapas: {
    titulo: string
    perguntas: {
      texto: string
      correta: Letra
      alternativas?: Alternativas
    }[]
  }[]
}

/**
 * Cria um quiz completo a partir de um roteiro declarativo, devolvendo os ids
 * na mesma forma do roteiro — é o que os specs usam para responder à pergunta
 * certa sem depender da ordem em que a tela as apresenta.
 */
export async function semearQuiz(roteiro: Roteiro) {
  const codigo = roteiro.codigo ?? `e2e${Date.now().toString(36)}`

  const [quizCriado] = await db
    .insert(quiz)
    .values({ titulo: roteiro.titulo ?? 'Formação de Professores', codigo })
    .returning()

  const etapas = []
  for (const [indice, roteiroDaEtapa] of roteiro.etapas.entries()) {
    const [etapaCriada] = await db
      .insert(etapa)
      .values({
        quizId: quizCriado.id,
        posicao: indice + 1,
        titulo: roteiroDaEtapa.titulo,
      })
      .returning()

    const perguntas = []
    for (const [
      posicao,
      roteiroDaPergunta,
    ] of roteiroDaEtapa.perguntas.entries()) {
      const alternativas = roteiroDaPergunta.alternativas ?? ALTERNATIVAS_PADRAO
      const [perguntaCriada] = await db
        .insert(pergunta)
        .values({
          etapaId: etapaCriada.id,
          posicao: posicao + 1,
          texto: roteiroDaPergunta.texto,
          altA: alternativas.a,
          altB: alternativas.b,
          altC: alternativas.c,
          altD: alternativas.d,
          correta: roteiroDaPergunta.correta,
        })
        .returning()
      perguntas.push(perguntaCriada)
    }

    etapas.push({ ...etapaCriada, perguntas })
  }

  return { ...quizCriado, etapas }
}

export async function abrirSessao(quizId: string) {
  const [linha] = await db.insert(sessao).values({ quizId }).returning()
  return linha
}

export async function participantesDaSessao(sessaoId: string) {
  return db
    .select()
    .from(participante)
    .where(sql`${participante.sessaoId} = ${sessaoId}`)
}

export async function respostasDaPergunta(perguntaId: string) {
  return db
    .select()
    .from(resposta)
    .where(sql`${resposta.perguntaId} = ${perguntaId}`)
    .orderBy(resposta.respondidaEm, resposta.id)
}

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@teste.local',
  senha: 'teste1234',
}
