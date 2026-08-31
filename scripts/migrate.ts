import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

config({ path: '.env', quiet: true })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL não está definida.')
  process.exit(1)
}

const pool = new Pool({ connectionString: url, max: 1 })

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log(`Migrações aplicadas em ${url.replace(/:[^:@]*@/, ':***@')}`)
} catch (erro) {
  console.error('Falha ao aplicar migrações:', erro)
  process.exitCode = 1
} finally {
  await pool.end()
}
