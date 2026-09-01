import { asc, eq, sql } from 'drizzle-orm'

import { db } from '@/server/db/client'
import { participante, quiz, sessao } from '@/server/db/schema'
import { placarDaSessao, type LinhaDoPlacar } from '@/server/placar'

/**
 * Tudo que o painel do organizador mostra, montado de uma vez.
 *
 * A tela não deduz nada: ela recebe o estado pronto e desenha. O que a
 * dinâmica é em cada instante fica num lugar só, no servidor, onde dá para
 * testar sem abrir navegador.
 */

export type ParticipanteNaGrade = {
  id: string
  nome: string
  /** A ordem em que entrou na sala — é o número do kart, `KART 07`. */
  numero: number
}

export type ProgressoDaPergunta = {
  id: string
  posicao: number
  texto: string
  respondidas: number
}

export type EstadoDoPainel = {
  quiz: { id: string; titulo: string; codigo: string }
  sessao: {
    id: string
    status: 'aguardando' | 'em_andamento' | 'finalizada'
    etapaAtualId: string | null
    etapaStatus: 'aberta' | 'encerrada' | null
  }
  etapas: { id: string; posicao: number; titulo: string; perguntas: number }[]
  participantes: ParticipanteNaGrade[]
  /** As perguntas da etapa aberta, com quantos já responderam cada uma. */
  progresso: ProgressoDaPergunta[]
  placar: LinhaDoPlacar[]
}

export async function estadoDoPainel(
  sessaoId: string
): Promise<EstadoDoPainel | null> {
  const [encontrada] = await db
    .select({
      id: sessao.id,
      status: sessao.status,
      etapaAtualId: sessao.etapaAtualId,
      etapaStatus: sessao.etapaStatus,
      quizId: quiz.id,
      titulo: quiz.titulo,
      codigo: quiz.codigo,
    })
    .from(sessao)
    .innerJoin(quiz, eq(quiz.id, sessao.quizId))
    .where(eq(sessao.id, sessaoId))

  if (!encontrada) return null

  const [etapas, participantes, progresso, placar] = await Promise.all([
    etapasDoQuiz(encontrada.quizId),
    grade(sessaoId),
    encontrada.etapaAtualId
      ? progressoDaEtapa(sessaoId, encontrada.etapaAtualId)
      : Promise.resolve([]),
    placarDaSessao(sessaoId),
  ])

  return {
    quiz: {
      id: encontrada.quizId,
      titulo: encontrada.titulo,
      codigo: encontrada.codigo,
    },
    sessao: {
      id: encontrada.id,
      status: encontrada.status,
      etapaAtualId: encontrada.etapaAtualId,
      etapaStatus: encontrada.etapaStatus,
    },
    etapas,
    participantes,
    progresso,
    placar,
  }
}

async function etapasDoQuiz(quizId: string) {
  const linhas = await db.execute<{
    id: string
    posicao: number
    titulo: string
    perguntas: number
  }>(sql`
    select e.id, e.posicao, e.titulo, count(p.id)::int as perguntas
    from etapa e
    left join pergunta p on p.etapa_id = e.id
    where e.quiz_id = ${quizId}
    group by e.id
    order by e.posicao
  `)
  return linhas.rows
}

/**
 * Quem está na sala, na ordem em que chegou.
 *
 * O número do kart não é coluna: é a posição na fila de entrada, calculada na
 * consulta. Guardar um contador daria duas verdades sobre a mesma coisa e uma
 * chance de elas divergirem.
 */
async function grade(sessaoId: string): Promise<ParticipanteNaGrade[]> {
  const linhas = await db
    .select({
      id: participante.id,
      nome: participante.nome,
      numero: sql<number>`row_number() over (order by ${participante.entrouEm}, ${participante.id})::int`,
    })
    .from(participante)
    .where(eq(participante.sessaoId, sessaoId))
    .orderBy(asc(participante.entrouEm), asc(participante.id))

  return linhas
}

/**
 * Quantas pessoas já responderam cada pergunta da etapa aberta. É o que diz ao
 * organizador se ainda vale esperar ou se já dá para encerrar.
 */
async function progressoDaEtapa(
  sessaoId: string,
  etapaId: string
): Promise<ProgressoDaPergunta[]> {
  const linhas = await db.execute<{
    id: string
    posicao: number
    texto: string
    respondidas: number
  }>(sql`
    select
      q.id,
      q.posicao,
      q.texto,
      count(desta_sessao.id)::int as respondidas
    from pergunta q
    -- A restrição de sessão vive dentro do que é juntado, e não num filtro
    -- depois: filtrar do lado de fora descartaria a linha inteira da pergunta
    -- quando a única resposta existente fosse de outra turma, e a pergunta
    -- sumiria do progresso em vez de aparecer com zero.
    left join (
      select r.id, r.pergunta_id
      from resposta r
      join participante p on p.id = r.participante_id
      where p.sessao_id = ${sessaoId}
    ) as desta_sessao on desta_sessao.pergunta_id = q.id
    where q.etapa_id = ${etapaId}
    group by q.id
    order by q.posicao
  `)
  return linhas.rows
}

/**
 * Verdadeiro quando todo mundo que está na sala já respondeu todas as perguntas
 * da etapa aberta — o momento em que não há mais o que esperar.
 */
export async function etapaEstaCompleta(
  sessaoId: string,
  etapaId: string
): Promise<boolean> {
  const [contagem] = (
    await db.execute<{ pessoas: number; perguntas: number; respostas: number }>(
      sql`
        select
          (select count(*)::int from participante
             where sessao_id = ${sessaoId}) as pessoas,
          (select count(*)::int from pergunta
             where etapa_id = ${etapaId}) as perguntas,
          (select count(*)::int
             from resposta r
             join participante pa on pa.id = r.participante_id
             join pergunta pe on pe.id = r.pergunta_id
            where pa.sessao_id = ${sessaoId}
              and pe.etapa_id = ${etapaId}) as respostas
      `
    )
  ).rows

  // Uma etapa sem pergunta, ou uma sala sem ninguém, não está "completa" —
  // encerrá-la sozinha seria fechar a etapa antes de a primeira pessoa entrar.
  if (!contagem || contagem.pessoas === 0 || contagem.perguntas === 0) {
    return false
  }

  return contagem.respostas >= contagem.pessoas * contagem.perguntas
}
