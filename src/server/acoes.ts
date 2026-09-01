import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { sortearCodigoDeQuiz } from '@/server/codigo'
import { db } from '@/server/db/client'
import { RecusaDeRegra, violou } from '@/server/db/erros'
import {
  etapa,
  LETRAS,
  participante,
  pergunta,
  quiz,
  sessao,
} from '@/server/db/schema'

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

/**
 * Os três números que a tela de projeção mostra ao lado do QR, e se já existe
 * sala aberta. Quem está chegando quer saber quanta gente já entrou e o tamanho
 * do que vem pela frente.
 */
export async function numerosDaProjecao(quizId: string) {
  const [porEtapa, [viva]] = await Promise.all([
    listarEtapas(quizId),
    db
      .select({
        id: sessao.id,
        naGrade: sql<number>`(
          select count(*)::int from ${participante}
          where ${participante.sessaoId} = ${sessao.id}
        )`,
      })
      .from(sessao)
      .where(and(eq(sessao.quizId, quizId), ne(sessao.status, 'finalizada'))),
  ])

  return {
    etapas: porEtapa.length,
    perguntas: porEtapa.reduce((total, etapa) => total + etapa.perguntas, 0),
    naGrade: viva?.naGrade ?? 0,
    salaAberta: Boolean(viva),
  }
}

export async function buscarEtapa(etapaId: string) {
  const [encontrada] = await db
    .select()
    .from(etapa)
    .where(eq(etapa.id, etapaId))
  return encontrada ?? null
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
    await reescreverPosicoes(transacao, FILA_DE_ETAPAS, excluida.quizId)
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

    await gravarOrdem(transacao, FILA_DE_ETAPAS, alvo.quizId, ordem)
    return { ...alvo, posicao: para + 1 }
  })
}

/**
 * A forma da pergunta é invariante do domínio: quatro alternativas preenchidas e
 * uma delas apontada como correta. O banco já recusa um gabarito fora de A–D;
 * o que este esquema acrescenta é recusar a alternativa em branco, que passaria
 * pela constraint de texto não nulo e chegaria vazia à tela do participante.
 */
export const esquemaDePergunta = z.object({
  texto: z.string().trim().min(1),
  altA: z.string().trim().min(1),
  altB: z.string().trim().min(1),
  altC: z.string().trim().min(1),
  altD: z.string().trim().min(1),
  correta: z.enum(LETRAS),
})

export type DadosDePergunta = z.infer<typeof esquemaDePergunta>

function validarPergunta(dados: unknown): DadosDePergunta {
  const lido = esquemaDePergunta.safeParse(dados)

  if (!lido.success) {
    throw new RecusaDeRegra(
      'A pergunta precisa do enunciado, das quatro alternativas preenchidas e da alternativa correta marcada.',
      400
    )
  }

  return lido.data
}

export async function listarPerguntas(etapaId: string) {
  return db
    .select()
    .from(pergunta)
    .where(eq(pergunta.etapaId, etapaId))
    .orderBy(asc(pergunta.posicao))
}

export async function criarPergunta(etapaId: string, dados: unknown) {
  const valida = validarPergunta(dados)

  return db.transaction(async (transacao) => {
    const [{ maior }] = await transacao
      .select({
        maior: sql<number>`coalesce(max(${pergunta.posicao}), 0)::int`,
      })
      .from(pergunta)
      .where(eq(pergunta.etapaId, etapaId))

    const [criada] = await transacao
      .insert(pergunta)
      .values({ ...valida, etapaId, posicao: maior + 1 })
      .returning()

    return criada
  })
}

export async function alterarPergunta(perguntaId: string, dados: unknown) {
  const valida = validarPergunta(dados)

  const [alterada] = await db
    .update(pergunta)
    .set(valida)
    .where(eq(pergunta.id, perguntaId))
    .returning()

  if (!alterada) throw new RecusaDeRegra('Pergunta não encontrada.', 404)
  return alterada
}

export async function excluirPergunta(perguntaId: string) {
  return db.transaction(async (transacao) => {
    const [excluida] = await transacao
      .delete(pergunta)
      .where(eq(pergunta.id, perguntaId))
      .returning()

    if (!excluida) throw new RecusaDeRegra('Pergunta não encontrada.', 404)

    await reescreverPosicoes(transacao, FILA_DE_PERGUNTAS, excluida.etapaId)
    return excluida
  })
}

/** Troca a pergunta de lugar com a vizinha na direção pedida. */
export async function moverPergunta(perguntaId: string, direcao: Direcao) {
  return db.transaction(async (transacao) => {
    const [alvo] = await transacao
      .select()
      .from(pergunta)
      .where(eq(pergunta.id, perguntaId))

    if (!alvo) throw new RecusaDeRegra('Pergunta não encontrada.', 404)

    const irmas = await transacao
      .select({ id: pergunta.id })
      .from(pergunta)
      .where(eq(pergunta.etapaId, alvo.etapaId))
      .orderBy(asc(pergunta.posicao))

    const de = irmas.findIndex((irma) => irma.id === perguntaId)
    const para = direcao === 'cima' ? de - 1 : de + 1

    if (para < 0 || para >= irmas.length) {
      throw new RecusaDeRegra(
        direcao === 'cima'
          ? 'Esta pergunta já é a primeira.'
          : 'Esta pergunta já é a última.',
        409
      )
    }

    const ordem = irmas.map((irma) => irma.id)
    ;[ordem[de], ordem[para]] = [ordem[para], ordem[de]]

    await gravarOrdem(transacao, FILA_DE_PERGUNTAS, alvo.etapaId, ordem)
    return { ...alvo, posicao: para + 1 }
  })
}

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Etapas dentro de um quiz e perguntas dentro de uma etapa são a mesma coisa:
 * uma fila numerada a partir de 1, com a numeração única dentro do dono.
 */
type Fila = {
  tabela: typeof etapa | typeof pergunta
  dono: 'quiz_id' | 'etapa_id'
}

const FILA_DE_ETAPAS: Fila = { tabela: etapa, dono: 'quiz_id' }
const FILA_DE_PERGUNTAS: Fila = { tabela: pergunta, dono: 'etapa_id' }

/**
 * A unicidade de (dono, posição) não é adiável, então uma reordenação não pode
 * passar por um estado com dois itens na mesma posição — nem por um instante.
 * A saída é ir por fora do intervalo: todas as posições viram negativas de uma
 * vez (a negação preserva a unicidade) e só então cada item recebe a posição
 * final, que naquele momento não existe em nenhuma linha.
 */
async function gravarOrdem(
  transacao: Transacao,
  fila: Fila,
  donoId: string,
  idsNaOrdem: string[]
) {
  const coluna = sql.identifier(fila.dono)

  await transacao.execute(
    sql`update ${fila.tabela} set posicao = -posicao where ${coluna} = ${donoId}`
  )

  for (const [indice, id] of idsNaOrdem.entries()) {
    await transacao.execute(
      sql`update ${fila.tabela} set posicao = ${indice + 1} where id = ${id}`
    )
  }
}

/** Fecha os buracos deixados por uma exclusão, preservando a ordem atual. */
async function reescreverPosicoes(
  transacao: Transacao,
  fila: Fila,
  donoId: string
) {
  const coluna = sql.identifier(fila.dono)
  const restantes = await transacao.execute<{ id: string }>(
    sql`select id from ${fila.tabela} where ${coluna} = ${donoId} order by posicao`
  )

  await gravarOrdem(
    transacao,
    fila,
    donoId,
    restantes.rows.map((linha) => linha.id)
  )
}
