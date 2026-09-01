import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { db } from '@/server/db/client'

/**
 * Aplica as migrações pendentes antes de a aplicação começar a servir.
 *
 * Correto porque a aplicação roda em **uma réplica só** — condição fixada no
 * compose de produção. Com duas, dois processos tentariam migrar ao mesmo
 * tempo o mesmo banco.
 *
 * Se falhar, o servidor não sobe. É o que se quer: uma aplicação servindo sobre
 * um banco desatualizado quebra de formas muito mais difíceis de diagnosticar.
 */
export async function migrarBanco(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrações aplicadas.')
}
