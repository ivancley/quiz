/**
 * As regras críticas do domínio são constraints do Postgres. Quando uma delas
 * dispara, o driver devolve um erro com o nome da constraint — é o que permite
 * transformar a violação em uma recusa que faz sentido para quem está usando,
 * em vez de vazar detalhe de banco para a tela.
 */

type ErroDoPostgres = {
  code?: string
  constraint?: string
  column?: string
  table?: string
  detail?: string
}

const CODIGO_UNICIDADE = '23505'
const CODIGO_CHECK = '23514'
const CODIGO_NAO_NULO = '23502'

function comoErroDoPostgres(erro: unknown): ErroDoPostgres | null {
  let atual: unknown = erro
  // O Drizzle embrulha o erro do driver; a causa é onde estão code e constraint.
  for (let profundidade = 0; atual && profundidade < 5; profundidade += 1) {
    const candidato = atual as ErroDoPostgres & { cause?: unknown }
    if (typeof candidato.code === 'string') return candidato
    atual = candidato.cause
  }
  return null
}

/** Nome da constraint violada, ou null se o erro não veio do banco. */
export function constraintViolada(erro: unknown): string | null {
  const pg = comoErroDoPostgres(erro)
  if (!pg) return null
  if (
    pg.code !== CODIGO_UNICIDADE &&
    pg.code !== CODIGO_CHECK &&
    pg.code !== CODIGO_NAO_NULO
  ) {
    return null
  }
  // Violação de NOT NULL não nomeia constraint; a coluna é a informação útil.
  return pg.constraint ?? pg.column ?? null
}

export function violou(erro: unknown, nome: string): boolean {
  return constraintViolada(erro) === nome
}

/** Erro de domínio: a operação foi recusada por uma regra, não por uma falha. */
export class RecusaDeRegra extends Error {
  constructor(
    readonly motivo: string,
    readonly status = 409
  ) {
    super(motivo)
    this.name = 'RecusaDeRegra'
  }
}
