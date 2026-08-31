/**
 * Gera a linha de ADMIN_PASSWORD_HASH para colar no .env.
 *
 *   npm run admin:hash -- 'sua-senha'
 *
 * A senha vem por argumento e não é gravada em lugar nenhum — só a linha sai na
 * saída padrão.
 *
 * A linha sai com os cifrões escapados de propósito. O carregador de .env do
 * Next.js expande $NOME nos valores, e um hash bcrypt é feito de cifrões: colado
 * cru, ele chega mutilado ao servidor e todo login passa a ser recusado, sem
 * nenhum erro que aponte para a causa.
 */
import { hash } from 'bcryptjs'

const senha = process.argv[2]

if (!senha) {
  console.error("Uso: npm run admin:hash -- 'sua-senha'")
  process.exit(1)
}

// 10 rodadas: o custo padrão do bcrypt, alguns milissegundos por verificação.
// Como só existe um login no sistema inteiro, não há razão para baratear.
const gerado = await hash(senha, 10)

const escapado = gerado.replaceAll('$', String.raw`\$`)

console.log(`ADMIN_PASSWORD_HASH='${escapado}'`)
