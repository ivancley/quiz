import { sql } from 'drizzle-orm'

import { db } from '@/server/db/client'
import { BONUS_POR_ORDEM, PONTO_POR_ACERTO } from '@/server/pontuacao'

export type LinhaDoPlacar = {
  participanteId: string
  nome: string
  posicao: number
  acertos: number
  bonus: number
  total: number
}

/**
 * A mesma tabela de bônus da regra pura, traduzida para SQL a partir dela.
 * Escrever os números de novo aqui criaria duas verdades sobre a mesma regra,
 * e a que estivesse errada seria justamente a que aparece projetada na parede.
 */
const BONUS_EM_SQL = sql.raw(
  BONUS_POR_ORDEM.map(
    (pontos, indice) => `when ${indice + 1} then ${pontos}`
  ).join(' ')
)

/**
 * O placar de uma sessão, calculado a cada consulta.
 *
 * A ordem de acerto sai de uma função de janela sobre as respostas certas,
 * particionada por pergunta e desempatada pelo identificador sequencial. Duas
 * respostas registradas no mesmo microssegundo têm identificadores diferentes
 * por construção, então é impossível duas pessoas receberem o mesmo bônus.
 *
 * Respostas erradas ficam de fora da contagem: errar rápido não gasta o lugar
 * de quem acertou depois.
 *
 * Quem ainda não pontuou continua na lista, com zero — sumir do placar seria
 * pior do que aparecer por último.
 */
export async function placarDaSessao(
  sessaoId: string
): Promise<LinhaDoPlacar[]> {
  const linhas = await db.execute<{
    participante_id: string
    nome: string
    acertos: number
    bonus: number
    total: number
  }>(sql`
    with acertos as (
      select
        r.id,
        r.participante_id,
        r.respondida_em,
        row_number() over (
          partition by p.sessao_id, r.pergunta_id
          order by r.respondida_em, r.id
        ) as ordem
      from resposta r
      join participante p on p.id = r.participante_id
      join pergunta q on q.id = r.pergunta_id
      where p.sessao_id = ${sessaoId}
        and r.escolhida = q.correta
    )
    select
      p.id as participante_id,
      p.nome,
      (count(a.id) * ${PONTO_POR_ACERTO})::int as acertos,
      coalesce(sum(case a.ordem ${BONUS_EM_SQL} else 0 end), 0)::int as bonus,
      (
        count(a.id) * ${PONTO_POR_ACERTO}
        + coalesce(sum(case a.ordem ${BONUS_EM_SQL} else 0 end), 0)
      )::int as total
    from participante p
    left join acertos a on a.participante_id = p.id
    where p.sessao_id = ${sessaoId}
    group by p.id, p.nome
    order by
      total desc,
      -- Empate no total vai para quem chegou lá primeiro: o instante do último
      -- ponto de cada um. Quem ainda não pontuou não tem instante, e fica no fim.
      max(a.respondida_em) asc nulls last,
      p.entrou_em asc
  `)

  return linhas.rows.map((linha, indice) => ({
    participanteId: linha.participante_id,
    nome: linha.nome,
    posicao: indice + 1,
    acertos: linha.acertos,
    bonus: linha.bonus,
    total: linha.total,
  }))
}
