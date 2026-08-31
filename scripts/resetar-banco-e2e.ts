/**
 * Recria do zero o banco da bateria ponta a ponta e aplica as migrações.
 *
 * O reset é do banco, não do container: derrubar o volume do Postgres levaria
 * junto o banco de desenvolvimento e o do Vitest. Aqui só `quiz_e2e` é
 * destruído, então a bateria pode rodar a qualquer momento sem custo para quem
 * está no meio de um trabalho.
 */
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

config({ path: '.env.e2e', quiet: true })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL não está definida em .env.e2e.')
  process.exit(1)
}

const alvo = new URL(url)
const nomeDoBanco = alvo.pathname.slice(1)

if (!/^[a-z0-9_]+$/.test(nomeDoBanco)) {
  // O nome vai interpolado num DDL, que não aceita parâmetro ligado.
  console.error(`Nome de banco inesperado: ${nomeDoBanco}`)
  process.exit(1)
}

if (!nomeDoBanco.endsWith('_e2e')) {
  // Trava contra apontar o .env.e2e para o banco de desenvolvimento por engano
  // e perder os quizzes cadastrados à mão.
  console.error(
    `Recusando apagar "${nomeDoBanco}": o banco da bateria precisa terminar em _e2e.`
  )
  process.exit(1)
}

// Conecta no banco administrativo: não dá para dropar aquele a que se está ligado.
const administrativo = new URL(url)
administrativo.pathname = '/postgres'

const admin = new Pool({ connectionString: administrativo.toString(), max: 1 })

try {
  // FORCE derruba as conexões pendentes de uma execução anterior interrompida
  // (um `next dev` que ficou de pé), em vez de falhar com "database is being
  // accessed by other users".
  await admin.query(`DROP DATABASE IF EXISTS ${nomeDoBanco} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${nomeDoBanco}`)
} catch (erro) {
  console.error('Falha ao recriar o banco da bateria:', erro)
  process.exit(1)
} finally {
  await admin.end()
}

const pool = new Pool({ connectionString: url, max: 1 })

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log(`Banco ${nomeDoBanco} recriado e migrado.`)
} catch (erro) {
  console.error('Falha ao aplicar migrações:', erro)
  process.exitCode = 1
} finally {
  await pool.end()
}
