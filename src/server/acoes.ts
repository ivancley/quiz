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
import { etapaEstaCompleta } from '@/server/estado'
import { publicar } from '@/server/realtime/hub'

/**
 * Toda escrita do sistema passa por aqui. As regras que o banco já garante em
 * constraint não são reverificadas: o que estas funções fazem é traduzir a
 * violação em uma recusa que faz sentido para quem está do outro lado da tela.
 */

const TENTATIVAS_DE_CODIGO = 5

/** Qualquer executor de consulta: o banco direto ou uma transação em curso. */
type Executor = typeof db | Transacao

/**
 * Recusa mexer no conteúdo de um quiz que está rodando.
 *
 * Trocar o gabarito de uma pergunta no meio de uma sessão passaria a corrigir
 * por outro critério respostas que já foram registradas — o placar projetado
 * mudaria sozinho, sem que ninguém tivesse respondido nada. Excluir uma etapa
 * faria o mesmo, de forma mais silenciosa ainda.
 */
async function exigirQuizParado(executor: Executor, quizId: string) {
  const [viva] = await executor
    .select({ id: sessao.id })
    .from(sessao)
    .where(and(eq(sessao.quizId, quizId), ne(sessao.status, 'finalizada')))

  if (viva) {
    throw new RecusaDeRegra(
      'Este quiz tem uma sessão em andamento. Encerre a sessão para poder editar.',
      409
    )
  }
}

/** O quiz a que a etapa pertence, para checar a mesma regra a partir dela. */
async function quizDaEtapa(executor: Executor, etapaId: string) {
  const [linha] = await executor
    .select({ quizId: etapa.quizId })
    .from(etapa)
    .where(eq(etapa.id, etapaId))
  return linha?.quizId ?? null
}

/** O quiz a que a pergunta pertence, dois saltos acima dela. */
async function quizDaPergunta(executor: Executor, perguntaId: string) {
  const [linha] = await executor
    .select({ quizId: etapa.quizId })
    .from(pergunta)
    .innerJoin(etapa, eq(etapa.id, pergunta.etapaId))
    .where(eq(pergunta.id, perguntaId))
  return linha?.quizId ?? null
}

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
  await exigirQuizParado(db, quizId)

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

/**
 * Uma sessão é uma execução do quiz com uma turma. O molde fica no quiz; o que
 * aconteceu — quem entrou, quem respondeu o quê — fica na sessão, e é por isso
 * que rodar a mesma dinâmica com outra turma não exige duplicar o conteúdo.
 */
export async function iniciarSessao(quizId: string) {
  const existe = await buscarQuiz(quizId)
  if (!existe) throw new RecusaDeRegra('Quiz não encontrado.', 404)

  try {
    const [criada] = await db.insert(sessao).values({ quizId }).returning()
    return criada
  } catch (erro) {
    // Um quiz roda com uma turma por vez, e quem garante isso é o índice
    // parcial do banco — não uma checagem antes do insert, que duas abas
    // clicando junto atravessariam.
    if (violou(erro, 'sessao_ativa_unica')) {
      throw new RecusaDeRegra(
        'Este quiz já tem uma sessão em andamento. Encerre a atual para abrir a próxima.',
        409
      )
    }
    throw erro
  }
}

export async function finalizarSessao(sessaoId: string) {
  const [finalizada] = await db
    .update(sessao)
    .set({
      status: 'finalizada',
      finalizadaEm: sql`now()`,
      // A etapa aberta morre junto com a sessão: deixá-la marcada como aberta
      // faria um celular reconectado continuar mostrando a pergunta.
      etapaAtualId: null,
      etapaStatus: null,
    })
    .where(and(eq(sessao.id, sessaoId), ne(sessao.status, 'finalizada')))
    .returning()

  if (!finalizada) {
    throw new RecusaDeRegra(
      'Sessão não encontrada ou já encerrada.',
      // Encerrar uma sessão já encerrada não é erro de quem clicou duas vezes.
      409
    )
  }

  // A bandeirada muda a tela de todo mundo ao mesmo tempo, e é o único aviso
  // que ninguém pode perder: quem ficasse sem ele continuaria olhando para uma
  // pergunta que não aceita mais resposta.
  publicar(finalizada.id, 'todos')

  return finalizada
}

/**
 * Abre a etapa: é o momento em que a pergunta vai ao ar e a sala inteira troca
 * de tela ao mesmo tempo.
 */
export async function abrirEtapa(sessaoId: string, etapaId: string) {
  const aberta = await db.transaction(async (transacao) => {
    const [atual] = await transacao
      .select()
      .from(sessao)
      .where(eq(sessao.id, sessaoId))

    if (!atual) throw new RecusaDeRegra('Sessão não encontrada.', 404)
    if (atual.status === 'finalizada') {
      throw new RecusaDeRegra('Esta sessão já foi encerrada.', 409)
    }
    if (atual.etapaStatus === 'aberta') {
      throw new RecusaDeRegra(
        'Encerre a etapa aberta antes de começar a próxima.',
        409
      )
    }

    const [alvo] = await transacao
      .select()
      .from(etapa)
      .where(eq(etapa.id, etapaId))

    if (!alvo || alvo.quizId !== atual.quizId) {
      throw new RecusaDeRegra('Etapa não encontrada neste quiz.', 404)
    }

    const [{ quantas }] = await transacao
      .select({ quantas: count(pergunta.id) })
      .from(pergunta)
      .where(eq(pergunta.etapaId, etapaId))

    // Abrir uma etapa vazia mandaria a sala para uma tela de pergunta sem
    // pergunta, e só o encerramento manual tiraria todo mundo de lá.
    if (quantas === 0) {
      throw new RecusaDeRegra(
        'Esta etapa ainda não tem perguntas. Cadastre ao menos uma antes de abrir.',
        409
      )
    }

    const [atualizada] = await transacao
      .update(sessao)
      .set({
        status: 'em_andamento',
        etapaAtualId: etapaId,
        etapaStatus: 'aberta',
      })
      .where(eq(sessao.id, sessaoId))
      .returning()

    return atualizada
  })

  publicar(sessaoId, 'todos')
  return aberta
}

/**
 * Encerra a etapa aberta. A autoridade é sempre do organizador: mesmo com gente
 * faltando responder, é ele quem decide que a volta acabou.
 */
export async function encerrarEtapa(sessaoId: string) {
  const [encerrada] = await db
    .update(sessao)
    .set({ etapaStatus: 'encerrada' })
    .where(and(eq(sessao.id, sessaoId), eq(sessao.etapaStatus, 'aberta')))
    .returning()

  if (!encerrada) {
    throw new RecusaDeRegra('Não há etapa aberta nesta sessão.', 409)
  }

  publicar(sessaoId, 'todos')
  return encerrada
}

/**
 * Encerra a etapa sozinha quando todo mundo na sala já respondeu tudo o que ela
 * tinha. É oportunista: se alguém entrou no meio e ainda deve respostas, a
 * etapa continua aberta e o organizador encerra na mão.
 *
 * Chamada depois de registrar uma resposta. Devolve se chegou a encerrar.
 */
export async function encerrarEtapaSeCompleta(
  sessaoId: string
): Promise<boolean> {
  const atual = await buscarSessao(sessaoId)
  if (!atual?.etapaAtualId || atual.etapaStatus !== 'aberta') return false

  if (!(await etapaEstaCompleta(sessaoId, atual.etapaAtualId))) return false

  await encerrarEtapa(sessaoId)
  return true
}

export async function buscarSessao(sessaoId: string) {
  const [encontrada] = await db
    .select()
    .from(sessao)
    .where(eq(sessao.id, sessaoId))
  return encontrada ?? null
}

export async function sessaoVivaDoQuiz(quizId: string) {
  const [viva] = await db
    .select()
    .from(sessao)
    .where(and(eq(sessao.quizId, quizId), ne(sessao.status, 'finalizada')))
  return viva ?? null
}

/** O histórico do quiz: a sessão viva, se houver, e todas as já realizadas. */
export async function listarSessoes(quizId: string) {
  return db
    .select({
      id: sessao.id,
      status: sessao.status,
      iniciadaEm: sessao.iniciadaEm,
      finalizadaEm: sessao.finalizadaEm,
      participantes: count(participante.id),
    })
    .from(sessao)
    .leftJoin(participante, eq(participante.sessaoId, sessao.id))
    .where(eq(sessao.quizId, quizId))
    .groupBy(sessao.id)
    .orderBy(sql`${sessao.iniciadaEm} desc`)
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
    await exigirQuizParado(transacao, quizId)

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

  const quizId = await quizDaEtapa(db, etapaId)
  if (!quizId) throw new RecusaDeRegra('Etapa não encontrada.', 404)
  await exigirQuizParado(db, quizId)

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
    const quizId = await quizDaEtapa(transacao, etapaId)
    if (!quizId) throw new RecusaDeRegra('Etapa não encontrada.', 404)
    await exigirQuizParado(transacao, quizId)

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
    await exigirQuizParado(transacao, alvo.quizId)

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
    const quizId = await quizDaEtapa(transacao, etapaId)
    if (!quizId) throw new RecusaDeRegra('Etapa não encontrada.', 404)
    await exigirQuizParado(transacao, quizId)

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

  const quizId = await quizDaPergunta(db, perguntaId)
  if (!quizId) throw new RecusaDeRegra('Pergunta não encontrada.', 404)
  await exigirQuizParado(db, quizId)

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
    const quizId = await quizDaPergunta(transacao, perguntaId)
    if (!quizId) throw new RecusaDeRegra('Pergunta não encontrada.', 404)
    await exigirQuizParado(transacao, quizId)

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

    const quizId = await quizDaEtapa(transacao, alvo.etapaId)
    if (quizId) await exigirQuizParado(transacao, quizId)

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
