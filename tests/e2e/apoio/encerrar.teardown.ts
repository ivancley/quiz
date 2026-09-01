/**
 * Roda uma vez, depois de todos os specs. Fecha a conexão que os arquivos
 * compartilham — fazer isso ao fim de cada spec derrubaria o banco debaixo dos
 * que ainda faltam rodar.
 */
import { test as encerrar } from '@playwright/test'

import { fecharBanco } from './banco'

encerrar('a bateria soltou a conexão com o banco', async () => {
  await fecharBanco()
})
