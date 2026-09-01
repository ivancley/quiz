import { and, asc, count, eq, sql } from 'drizzle-orm'

import { db } from '@/server/db/client'
import { RecusaDeRegra, violou } from '@/server/db/erros'
import { etapa, pergunta, quiz } from '@/server/db/schema'
import { sortearCodigoDeQuiz } from '@/server/codigo'

/**
 * Toda escrita do sistema passa por aqui. As regras que o banco já garante em
 * constraint não são reverificadas: o que estas funções fazem é traduzir a
 * violação em uma recusa que faz sentido para quem está do outro lado da tela.
 */

const TENTATIVAS_DE_CODIGO = 5

export async function criarQuiz(titulo: string) {
  const nome = titulo.trim()
  if (!nome) throw new RecusaDeRegra('O quiz precisa de um título.', 400)

  // O código é sorteado, então pode colidir com um já existente. Colisão em
  // 31^6 é rara o bastante para não valer um laço de reserva prévia, e comum o
  // bastante para não valer confiar na sorte.
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CODIGO; tentativa += 1) {
    try {
      const [criado] = await db
        .insert(quiz)
        .values({ titulo: nome, codigo: sortearCodigoDeQuiz() })
        .returning()
      return criado
    } catch (erro) {
      if (!violou(erro, 'quiz_codigo_unique')) throw erro
    }
  }

  throw new RecusaDeRegra(
    'Não foi possível gerar um código de entrada. Tente de novo.',
    503
  )
}

export async function renomearQuiz(quizId: string, titulo: string) {
  const nome = titulo.trim()
  if (!nome) throw new RecusaDeRegra('O quiz precisa de um título.', 400)

  const [alterado] = await db
    .update(quiz)
    .set({ titulo: nome })
    .where(eq(quiz.id, quizId))
    .returning()

  if (!alterado) throw new RecusaDeRegra('Quiz não encontrado.', 404)
  return alterado
}

export async function excluirQuiz(quizId: string) {
  const [excluido] = await db
    .delete(quiz)
    .where(eq(quiz.id, quizId))
    .returning()

  if (!excluido) throw new RecusaDeRegra('Quiz não encontrado.', 404)
  return excluido
}

/** A listagem da área administrativa: o quiz e o tamanho do que já foi montado. */
export async function listarQuizzes() {
  const etapasPorQuiz = db
    .select({
      quizId: etapa.quizId,
      etapas: count(etapa.id).as('etapas'),
    })
    .from(etapa)
    .groupBy(etapa.quizId)
    .as('etapas_por_quiz')

  const perguntasPorQuiz = db
    .select({
      quizId: etapa.quizId,
      perguntas: count(pergunta.id).as('perguntas'),
    })
    .from(pergunta)
    .innerJoin(etapa, eq(etapa.id, pergunta.etapaId))
    .groupBy(etapa.quizId)
    .as('perguntas_por_quiz')

  return db
    .select({
      id: quiz.id,
      titulo: quiz.titulo,
      codigo: quiz.codigo,
      criadoEm: quiz.criadoEm,
      etapas: sql<number>`coalesce(${etapasPorQuiz.etapas}, 0)::int`,
      perguntas: sql<number>`coalesce(${perguntasPorQuiz.perguntas}, 0)::int`,
    })
    .from(quiz)
    .leftJoin(etapasPorQuiz, eq(etapasPorQuiz.quizId, quiz.id))
    .leftJoin(perguntasPorQuiz, eq(perguntasPorQuiz.quizId, quiz.id))
    .orderBy(sql`${quiz.criadoEm} desc`)
}

export async function buscarQuiz(quizId: string) {
  const [encontrado] = await db.select().from(quiz).where(eq(quiz.id, quizId))
  return encontrado ?? null
}

export async function listarEtapas(quizId: string) {
  return db
    .select({
      id: etapa.id,
      quizId: etapa.quizId,
      posicao: etapa.posicao,
      titulo: etapa.titulo,
      // Conta a coluna, e não as linhas: com o LEFT JOIN, uma etapa sem
      // pergunta ainda produz uma linha, e count(*) devolveria 1 para ela.
      perguntas: count(pergunta.id),
    })
    .from(etapa)
    .leftJoin(pergunta, eq(pergunta.etapaId, etapa.id))
    .where(eq(etapa.quizId, quizId))
    .groupBy(etapa.id)
    .orderBy(asc(etapa.posicao))
}

export async function criarEtapa(quizId: string, titulo: string) {
  const nome = titulo.trim()
  if (!nome) throw new RecusaDeRegra('A etapa precisa de um título.', 400)

  return db.transaction(async (transacao) => {
    const [{ maior }] = await transacao
      .select({ maior: sql<number>`coalesce(max(${etapa.posicao}), 0)::int` })
      .from(etapa)
      .where(eq(etapa.quizId, quizId))

    const [criada] = await transacao
      .insert(etapa)
      .values({ quizId, titulo: nome, posicao: maior + 1 })
      .returning()

    return criada
  })
}

export async function renomearEtapa(etapaId: string, titulo: string) {
  const nome = titulo.trim()
  if (!nome) throw new RecusaDeRegra('A etapa precisa de um título.', 400)

  const [alterada] = await db
    .update(etapa)
    .set({ titulo: nome })
    .where(eq(etapa.id, etapaId))
    .returning()

  if (!alterada) throw new RecusaDeRegra('Etapa não encontrada.', 404)
  return alterada
}

export async function excluirEtapa(etapaId: string) {
  return db.transaction(async (transacao) => {
    const [excluida] = await transacao
      .delete(etapa)
      .where(eq(etapa.id, etapaId))
      .returning()

    if (!excluida) throw new RecusaDeRegra('Etapa não encontrada.', 404)

    // Sem isto, excluir a etapa 2 de três deixaria as posições em 1 e 3, e a
    // próxima etapa criada nasceria na 4 — o buraco vira permanente.
    await reescreverPosicoes(transacao, excluida.quizId)
    return excluida
  })
}

export type Direcao = 'cima' | 'baixo'

/** Troca a etapa de lugar com a vizinha na direção pedida. */
export async function moverEtapa(etapaId: string, direcao: Direcao) {
  return db.transaction(async (transacao) => {
    const [alvo] = await transacao
      .select()
      .from(etapa)
      .where(eq(etapa.id, etapaId))

    if (!alvo) throw new RecusaDeRegra('Etapa não encontrada.', 404)

    const irmas = await transacao
      .select({ id: etapa.id })
      .from(etapa)
      .where(eq(etapa.quizId, alvo.quizId))
      .orderBy(asc(etapa.posicao))

    const de = irmas.findIndex((irma) => irma.id === etapaId)
    const para = direcao === 'cima' ? de - 1 : de + 1

    if (para < 0 || para >= irmas.length) {
      throw new RecusaDeRegra(
        direcao === 'cima'
          ? 'Esta etapa já é a primeira.'
          : 'Esta etapa já é a última.',
        409
      )
    }

    const ordem = irmas.map((irma) => irma.id)
    ;[ordem[de], ordem[para]] = [ordem[para], ordem[de]]

    await gravarOrdem(transacao, alvo.quizId, ordem)
    return { ...alvo, posicao: para + 1 }
  })
}

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * A unicidade de (quiz, posição) não é adiável, então uma reordenação não pode
 * passar por um estado com duas etapas na mesma posição — nem por um instante.
 * A saída é ir por fora do intervalo: todas as posições viram negativas de uma
 * vez (a negação preserva a unicidade) e só então cada etapa recebe a posição
 * final, que naquele momento não existe em nenhuma linha.
 */
async function gravarOrdem(
  transacao: Transacao,
  quizId: string,
  idsNaOrdem: string[]
) {
  await transacao
    .update(etapa)
    .set({ posicao: sql`-${etapa.posicao}` })
    .where(eq(etapa.quizId, quizId))

  for (const [indice, id] of idsNaOrdem.entries()) {
    await transacao
      .update(etapa)
      .set({ posicao: indice + 1 })
      .where(and(eq(etapa.id, id), eq(etapa.quizId, quizId)))
  }
}

/** Fecha os buracos deixados por uma exclusão, preservando a ordem atual. */
async function reescreverPosicoes(transacao: Transacao, quizId: string) {
  const restantes = await transacao
    .select({ id: etapa.id })
    .from(etapa)
    .where(eq(etapa.quizId, quizId))
    .orderBy(asc(etapa.posicao))

  await gravarOrdem(
    transacao,
    quizId,
    restantes.map((linha) => linha.id)
  )
}
