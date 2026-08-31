/**
 * Leitura das variáveis de ambiente que a aplicação não sabe operar sem.
 *
 * Cada uma delas é lida por uma função que explode com uma mensagem dizendo o
 * que falta e como resolver. Uma credencial ausente que só aparece quando o
 * administrador tenta entrar, no meio da dinâmica, com a sala esperando, é
 * exatamente o tipo de falha que não pode chegar até ali.
 */

function obrigatoria(nome: string, comoResolver: string): string {
  const valor = process.env[nome]
  if (!valor) {
    throw new Error(`${nome} não está definida. ${comoResolver}`)
  }
  return valor
}

export function emailDoAdministrador(): string {
  return obrigatoria(
    'ADMIN_EMAIL',
    'É o e-mail do único administrador da instalação.'
  )
}

/** Um hash bcrypt completo: prefixo, custo e os 53 caracteres do resumo. */
const FORMA_DO_HASH = /^\$2[aby]?\$\d{2}\$.{53}$/

export function hashDaSenhaDoAdministrador(): string {
  const valor = obrigatoria(
    'ADMIN_PASSWORD_HASH',
    "Gere a linha com: npm run admin:hash -- 'sua-senha'."
  )

  // Um hash truncado não faz o bcrypt falhar: ele apenas recusa toda senha,
  // para sempre e sem dizer por quê. A causa quase certa é o carregador de .env
  // do Next.js ter expandido os cifrões do hash como se fossem variáveis —
  // motivo pelo qual o gerador entrega a linha já escapada.
  if (!FORMA_DO_HASH.test(valor)) {
    throw new Error(
      'ADMIN_PASSWORD_HASH não tem a forma de um hash bcrypt. Se os cifrões ' +
        'não estiverem escapados no .env, o valor chega mutilado. Regere com: ' +
        "npm run admin:hash -- 'sua-senha' e cole a linha inteira."
    )
  }

  return valor
}

/**
 * A chave assina os cookies de administrador e de participante. Trocá-la
 * invalida todos os cookies já emitidos — o que é o comportamento desejado.
 */
export function segredoDeAssinatura(): Uint8Array {
  const valor = obrigatoria('AUTH_SECRET', 'Gere com: openssl rand -base64 48.')
  return new TextEncoder().encode(valor)
}

/**
 * Chamada uma vez, quando o servidor sobe. Toca em todas as variáveis para que
 * uma configuração incompleta derrube o processo na largada, em vez de
 * produzir uma tela quebrada na primeira requisição.
 */
export function verificarAmbiente(): void {
  emailDoAdministrador()
  hashDaSenhaDoAdministrador()
  segredoDeAssinatura()
}
