/**
 * Chamada às rotas de escrita a partir das telas.
 *
 * As rotas respondem `{dados}` quando dá certo e `{erro}` quando recusam. Aqui
 * isso vira uma coisa só: a mensagem para mostrar, ou nada. Nenhuma tela
 * precisa saber ler status HTTP para dizer o que aconteceu.
 */

type Metodo = 'POST' | 'PATCH' | 'DELETE'

const FALHA_DE_REDE = 'Não foi possível falar com o servidor.'

export async function enviar(
  endereco: string,
  metodo: Metodo,
  corpo?: unknown
): Promise<string | null> {
  try {
    const resposta = await fetch(endereco, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })

    if (resposta.ok) return null

    const conteudo = await resposta.json().catch(() => null)
    return typeof conteudo?.erro === 'string'
      ? conteudo.erro
      : 'A operação não foi concluída.'
  } catch {
    return FALHA_DE_REDE
  }
}
