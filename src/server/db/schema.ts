import { sql } from 'drizzle-orm'
import {
  bigserial,
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** As quatro alternativas são fixas: a forma da pergunta é invariante do domínio. */
export const LETRAS = ['A', 'B', 'C', 'D'] as const
export type Letra = (typeof LETRAS)[number]

export const statusSessao = pgEnum('status_sessao', [
  'aguardando',
  'em_andamento',
  'finalizada',
])

export const statusEtapa = pgEnum('status_etapa', ['aberta', 'encerrada'])

export const quiz = pgTable('quiz', {
  id: uuid('id').primaryKey().defaultRandom(),
  titulo: text('titulo').notNull(),
  /** Vai impresso no QR Code e projetado na parede; aleatório, nunca sequencial. */
  codigo: text('codigo').notNull().unique(),
  criadoEm: timestamp('criado_em', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const etapa = pgTable(
  'etapa',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quiz.id, { onDelete: 'cascade' }),
    posicao: integer('posicao').notNull(),
    titulo: text('titulo').notNull(),
  },
  (t) => [
    // Adiável para que uma reordenação inteira caiba numa transação sem passar
    // por um estado intermediário com duas etapas na mesma posição.
    unique('etapa_posicao_unica').on(t.quizId, t.posicao).nullsNotDistinct(),
    index('etapa_por_quiz').on(t.quizId, t.posicao),
  ]
)

export const pergunta = pgTable(
  'pergunta',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    etapaId: uuid('etapa_id')
      .notNull()
      .references(() => etapa.id, { onDelete: 'cascade' }),
    posicao: integer('posicao').notNull(),
    texto: text('texto').notNull(),
    altA: text('alt_a').notNull(),
    altB: text('alt_b').notNull(),
    altC: text('alt_c').notNull(),
    altD: text('alt_d').notNull(),
    correta: char('correta', { length: 1 }).$type<Letra>().notNull(),
  },
  (t) => [
    unique('pergunta_posicao_unica').on(t.etapaId, t.posicao),
    // Exatamente uma alternativa correta, e ela é uma das quatro que existem:
    // o estado inválido deixa de ser representável.
    check('pergunta_correta_valida', sql`${t.correta} IN ('A','B','C','D')`),
    index('pergunta_por_etapa').on(t.etapaId, t.posicao),
  ]
)

export const sessao = pgTable(
  'sessao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quiz.id, { onDelete: 'cascade' }),
    status: statusSessao('status').notNull().default('aguardando'),
    etapaAtualId: uuid('etapa_atual_id').references(() => etapa.id, {
      onDelete: 'set null',
    }),
    etapaStatus: statusEtapa('etapa_status'),
    iniciadaEm: timestamp('iniciada_em', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finalizadaEm: timestamp('finalizada_em', { withTimezone: true }),
  },
  (t) => [
    // Um quiz roda com uma turma por vez. Sessões finalizadas ficam fora do
    // índice, então o histórico não impede a próxima execução.
    uniqueIndex('sessao_ativa_unica')
      .on(t.quizId)
      .where(sql`status <> 'finalizada'`),
  ]
)

export const participante = pgTable(
  'participante',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessaoId: uuid('sessao_id')
      .notNull()
      .references(() => sessao.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    entrouEm: timestamp('entrou_em', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Dois "Marina" na mesma sala tornariam o placar projetado ambíguo.
    uniqueIndex('participante_nome_unico').on(
      t.sessaoId,
      sql`lower(${t.nome})`
    ),
    index('participante_por_sessao').on(t.sessaoId, t.entrouEm),
  ]
)

export const resposta = pgTable(
  'resposta',
  {
    // Sequencial, e não UUID: é o desempate determinístico entre duas respostas
    // corretas registradas no mesmo instante.
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    participanteId: uuid('participante_id')
      .notNull()
      .references(() => participante.id, { onDelete: 'cascade' }),
    perguntaId: uuid('pergunta_id')
      .notNull()
      .references(() => pergunta.id, { onDelete: 'cascade' }),
    escolhida: char('escolhida', { length: 1 }).$type<Letra>().notNull(),
    // clock_timestamp() e não now(): now() devolve o início da transação e daria
    // o mesmo valor para respostas concorrentes.
    respondidaEm: timestamp('respondida_em', { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    // A resposta é definitiva; sem isso o bônus de velocidade seria burlável.
    unique('resposta_unica_por_pergunta').on(t.participanteId, t.perguntaId),
    check(
      'resposta_escolhida_valida',
      sql`${t.escolhida} IN ('A','B','C','D')`
    ),
    index('resposta_por_pergunta').on(t.perguntaId, t.respondidaEm, t.id),
  ]
)

export type Quiz = typeof quiz.$inferSelect
export type Etapa = typeof etapa.$inferSelect
export type Pergunta = typeof pergunta.$inferSelect
export type Sessao = typeof sessao.$inferSelect
export type Participante = typeof participante.$inferSelect
export type Resposta = typeof resposta.$inferSelect
