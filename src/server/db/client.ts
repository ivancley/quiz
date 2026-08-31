import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

function urlDoBanco(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL não está definida. Copie .env.example para .env e preencha.'
    )
  }
  return url
}

// Uma única instância por processo, reaproveitada entre recarregamentos de
// módulo em desenvolvimento para não abrir um pool novo a cada edição.
const global_ = globalThis as unknown as { poolDoQuiz?: Pool }

export const pool = (global_.poolDoQuiz ??= new Pool({
  connectionString: urlDoBanco(),
  max: 10,
}))

export const db = drizzle(pool, { schema })

export type Banco = typeof db
