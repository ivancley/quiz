import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

// Uma única instância por processo, reaproveitada entre recarregamentos de
// módulo em desenvolvimento para não abrir um pool novo a cada edição.
const global_ = globalThis as unknown as { poolDoQuiz?: Pool }

// O pool é montado sem exigir o endereço, e o `pg` só abre conexão na primeira
// consulta. Isso é o que permite compilar a aplicação sem um banco por perto —
// o build percorre os módulos de todas as rotas, e um erro aqui derrubaria a
// construção da imagem. Endereço ausente é conferido quando o servidor sobe,
// por `verificarAmbiente`, que é onde a falta tem conserto.
export const pool = (global_.poolDoQuiz ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
}))

export const db = drizzle(pool, { schema })
