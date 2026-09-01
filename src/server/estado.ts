import { and, asc, eq, ne, sql } from 'drizzle-orm'

import { perguntaEmJogo, type PerguntaEmJogo } from '@/server/apresentacao'
import type { Identidade } from '@/server/auth/participante'
import { db } from '@/server/db/client'
import {
  participante,
  pergunta,
  quiz,
  sessao,
  type Quiz,
} from '@/server/db/schema'
import {
  placarDaSessao,
  voltaDoParticipante,
  type LinhaDoPlacar,
  type PontoDaPergunta,
} from '@/server/placar'

/**
 * Tudo que cada tela mostra, montado de uma vez.
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

/**
 * O estado do celular de quem participa.
 *
 * A união é por tela, e não por dado: o servidor decide o que aparece e o
 * celular só desenha. É o que faz de "entrar no meio da etapa" e de "escanear
 * antes de a sala abrir" casos comuns em vez de exceções — e o que impede o
 * cliente de deduzir errado, já que ele não deduz nada.
 */

export type ResumoDoQuiz = {
  id: string
  titulo: string
  codigo: string
  etapas: number
  perguntas: number
}

export type EtapaEmJogo = {
  id: string
  posicao: number
  titulo: string
  perguntas: number
}

/** A etapa que ainda vai abrir, para a tela dizer o que vem pela frente. */
export type EtapaAnunciada = {
  posicao: number
  titulo: string
}

/**
 * Um traço por pergunta da etapa, na barra do topo da tela de pergunta.
 *
 * `acertou` e `errou` só aparecem em pergunta já respondida. As demais são
 * `atual` ou `pendente`, sem qualquer traço do gabarito.
 */
export type Segmento = 'acertou' | 'errou' | 'atual' | 'pendente'

export type EstadoDoParticipante =
  | { tela: 'sem-sessao'; quiz: ResumoDoQuiz }
  | { tela: 'entrada'; quiz: ResumoDoQuiz; sessaoId: string; naGrade: number }
  | {
      tela: 'espera'
      quiz: ResumoDoQuiz
      sessaoId: string
      eu: ParticipanteNaGrade
      naGrade: number
      proxima: EtapaAnunciada | null
    }
  | {
      tela: 'pergunta'
      quiz: ResumoDoQuiz
      sessaoId: string
      eu: ParticipanteNaGrade
      etapa: EtapaEmJogo
      pergunta: PerguntaEmJogo
      segmentos: Segmento[]
      pontosNaEtapa: number
    }
  | {
      tela: 'resultado-etapa'
      quiz: ResumoDoQuiz
      sessaoId: string
      eu: ParticipanteNaGrade
      etapa: EtapaEmJogo
      /** Falso enquanto os outros ainda respondem a etapa que esta pessoa terminou. */
      encerrada: boolean
      volta: PontoDaPergunta[]
      pontosNaEtapa: number
      total: number
      posicao: number
      proxima: EtapaAnunciada | null
    }
  | {
      tela: 'final'
      quiz: ResumoDoQuiz
      sessaoId: string
      eu: ParticipanteNaGrade
      total: number
      posicao: number
      naGrade: number
    }

export async function estadoDoParticipante(
  doCodigo: Quiz,
  identidade: Identidade | null
): Promise<EstadoDoParticipante> {
  const [resumo, etapas, viva] = await Promise.all([
    resumoDoQuiz(doCodigo),
    etapasDoQuiz(doCodigo.id),
    sessaoVivaDoQuiz(doCodigo.id),
  ])

  if (!viva) {
    // A bandeirada final não pode apagar a tela de quem estava na corrida:
    // quem jogou a sessão que acabou de encerrar continua vendo o resultado.
    return (
      (await bandeirada(resumo, doCodigo.id, identidade)) ?? {
        tela: 'sem-sessao',
        quiz: resumo,
      }
    )
  }

  const naGrade = await grade(viva.id)
  const eu =
    identidade?.sessaoId === viva.id
      ? naGrade.find((pessoa) => pessoa.id === identidade.participanteId)
      : undefined

  // Cookie de outra sessão, ou de um participante que não está mais na sala:
  // é gente que precisa dizer o nome de novo, não um erro a exibir.
  if (!eu) {
    return {
      tela: 'entrada',
      quiz: resumo,
      sessaoId: viva.id,
      naGrade: naGrade.length,
    }
  }

  const comum = { quiz: resumo, sessaoId: viva.id, eu } as const
  const emFoco = etapas.find((etapa) => etapa.id === viva.etapaAtualId)
  const proxima = proximaEtapa(etapas, viva.etapaAtualId)
  const naEspera = {
    tela: 'espera',
    ...comum,
    naGrade: naGrade.length,
    proxima,
  } as const

  if (!emFoco) return naEspera

  const volta = await voltaDoParticipante(viva.id, eu.id, emFoco.id)
  const pendente = volta.find((ponto) => ponto.escolhida === null)

  // Arrow, e não declaração: uma declaração é içada para o topo da função, e
  // com isso o TypeScript perde a garantia de que `emFoco` já foi conferida.
  const resultado = async (encerrada: boolean) => {
    const meuLugar = await meuLugarNoPlacar(comum.sessaoId, comum.eu.id)
    return {
      tela: 'resultado-etapa',
      ...comum,
      etapa: emFoco,
      encerrada,
      volta,
      pontosNaEtapa: somarPontos(volta),
      total: meuLugar.total,
      posicao: meuLugar.posicao,
      proxima,
    } as const
  }

  if (viva.etapaStatus === 'aberta') {
    // Quem terminou antes dos outros já vê o próprio resultado, mesmo com a
    // etapa ainda correndo — foi o que ele fez, e não vai mudar mais.
    if (!pendente) return resultado(false)

    const [linha] = await db
      .select()
      .from(pergunta)
      .where(eq(pergunta.id, pendente.perguntaId))

    return {
      tela: 'pergunta',
      ...comum,
      etapa: emFoco,
      pergunta: perguntaEmJogo(linha),
      segmentos: segmentosDaEtapa(volta, pendente.perguntaId),
      pontosNaEtapa: somarPontos(volta),
    }
  }

  // Etapa encerrada e nenhuma resposta desta pessoa nela: chegou depois do fim
  // da volta, e não tem resultado nenhum para ver — espera a próxima.
  return volta.some((ponto) => ponto.escolhida !== null)
    ? resultado(true)
    : naEspera
}

/** O quiz e o tamanho da corrida, para o cabeçalho de todas as telas. */
async function resumoDoQuiz(doCodigo: Quiz): Promise<ResumoDoQuiz> {
  const [contagem] = (
    await db.execute<{ etapas: number; perguntas: number }>(sql`
      select
        (select count(*)::int from etapa e
           where e.quiz_id = ${doCodigo.id}) as etapas,
        (select count(*)::int from pergunta p
           join etapa e on e.id = p.etapa_id
          where e.quiz_id = ${doCodigo.id}) as perguntas
    `)
  ).rows

  return {
    id: doCodigo.id,
    titulo: doCodigo.titulo,
    codigo: doCodigo.codigo,
    etapas: contagem?.etapas ?? 0,
    perguntas: contagem?.perguntas ?? 0,
  }
}

/**
 * A sessão que está rodando agora. O endereço do QR é fixo por quiz e resolve
 * para a turma do momento — é o que permite projetar o mesmo cartaz de manhã e
 * à tarde.
 */
export async function sessaoVivaDoQuiz(quizId: string) {
  const [encontrada] = await db
    .select()
    .from(sessao)
    .where(and(eq(sessao.quizId, quizId), ne(sessao.status, 'finalizada')))
  return encontrada ?? null
}

/**
 * A tela de quem jogou a sessão que já recebeu a bandeirada final. Devolve null
 * quando o cookie não aponta para uma sessão encerrada deste quiz — aí é gente
 * que nunca jogou, e o caminho é a entrada.
 */
async function bandeirada(
  resumo: ResumoDoQuiz,
  quizId: string,
  identidade: Identidade | null
): Promise<EstadoDoParticipante | null> {
  if (!identidade) return null

  const [encerrada] = await db
    .select({ id: sessao.id })
    .from(sessao)
    .where(
      and(
        eq(sessao.id, identidade.sessaoId),
        eq(sessao.quizId, quizId),
        eq(sessao.status, 'finalizada')
      )
    )

  if (!encerrada) return null

  const naGrade = await grade(encerrada.id)
  const eu = naGrade.find((pessoa) => pessoa.id === identidade.participanteId)
  if (!eu) return null

  const meuLugar = await meuLugarNoPlacar(encerrada.id, eu.id)

  return {
    tela: 'final',
    quiz: resumo,
    sessaoId: encerrada.id,
    eu,
    total: meuLugar.total,
    posicao: meuLugar.posicao,
    naGrade: naGrade.length,
  }
}

/** A etapa seguinte à que está em foco; a primeira, se a corrida nem começou. */
function proximaEtapa(
  etapas: EtapaEmJogo[],
  etapaAtualId: string | null
): EtapaAnunciada | null {
  const seguinte = etapaAtualId
    ? etapas[etapas.findIndex((etapa) => etapa.id === etapaAtualId) + 1]
    : etapas[0]

  return seguinte
    ? { posicao: seguinte.posicao, titulo: seguinte.titulo }
    : null
}

/**
 * A barra do topo da tela de pergunta. Acerto e erro só aparecem em pergunta já
 * respondida; o que ainda não foi respondido não diz nada sobre o gabarito.
 */
function segmentosDaEtapa(
  volta: PontoDaPergunta[],
  perguntaAtualId: string
): Segmento[] {
  return volta.map((ponto) => {
    if (ponto.escolhida === null) {
      return ponto.perguntaId === perguntaAtualId ? 'atual' : 'pendente'
    }
    return ponto.acertou ? 'acertou' : 'errou'
  })
}

export function somarPontos(volta: PontoDaPergunta[]): number {
  return volta.reduce((total, ponto) => total + ponto.pontos, 0)
}

/**
 * O total e a posição de uma pessoa, tirados do mesmo placar que o painel
 * projeta. Recalcular por outro caminho aqui seria a receita para o celular e a
 * parede discordarem na frente da sala.
 */
async function meuLugarNoPlacar(sessaoId: string, participanteId: string) {
  const placar = await placarDaSessao(sessaoId)
  const minha = placar.find((linha) => linha.participanteId === participanteId)
  return {
    total: minha?.total ?? 0,
    posicao: minha?.posicao ?? placar.length,
  }
}
