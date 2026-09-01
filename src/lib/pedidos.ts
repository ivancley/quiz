/**
 * Chamada às rotas de escrita a partir das telas.
 *
 * As rotas respondem `{dados}` quando dá certo e `{erro}` quando recusam. Aqui
 * isso vira uma coisa só: a mensagem para mostrar, ou nada. Nenhuma tela
 * precisa saber ler status HTTP para dizer o que aconteceu.
 */

type Metodo = 'POST' | 'PATCH' | 'DELETE'

const FALHA_DE_REDE = 'Não foi possível falar com o servidor.'

export type Retorno<T> =
  { dados: T; erro: null } | { dados: null; erro: string }

/** Para as chamadas cuja resposta a tela precisa mostrar. */
export async function enviarEReceber<T>(
  endereco: string,
  metodo: Metodo,
  corpo?: unknown
): Promise<Retorno<T>> {
  try {
    const resposta = await fetch(endereco, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })

    const conteudo = await resposta.json().catch(() => null)

    if (resposta.ok) return { dados: conteudo?.dados as T, erro: null }

    return {
      dados: null,
      erro:
        typeof conteudo?.erro === 'string'
          ? conteudo.erro
          : 'A operação não foi concluída.',
    }
  } catch {
    return { dados: null, erro: FALHA_DE_REDE }
  }
}

/** Para as chamadas em que só interessa se deu certo. */
export async function enviar(
  endereco: string,
  metodo: Metodo,
  corpo?: unknown
): Promise<string | null> {
  return (await enviarEReceber(endereco, metodo, corpo)).erro
}
