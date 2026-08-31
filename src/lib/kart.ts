/**
 * Cada participante é um kart: um selo com a inicial do nome e uma cor.
 *
 * A cor não é armazenada. Ela é derivada do identificador do participante, que
 * é imutável, para que o mesmo kart apareça igual no celular, na pista do painel
 * e no pódio — sem coluna no banco e sem risco de duas fontes divergirem.
 */

export type CorDeKart = {
  fundo: string
  sombra: string
  texto: string
}

/** Tirada dos acentos do tema; nenhuma se confunde com outra à distância. */
export const CORES_DE_KART: readonly CorDeKart[] = [
  { fundo: '#e0463c', sombra: '#8c1f19', texto: '#f6f1e4' },
  { fundo: '#4aa8e0', sombra: '#24597a', texto: '#08182a' },
  { fundo: '#4cbf72', sombra: '#2b7846', texto: '#08170e' },
  { fundo: '#f2c14a', sombra: '#7a611f', texto: '#2a2312' },
  { fundo: '#b968d9', sombra: '#6b2f85', texto: '#f6f1e4' },
  { fundo: '#e88b3d', sombra: '#8f4d15', texto: '#2a1a08' },
  { fundo: '#3fc4c0', sombra: '#1d6f6d', texto: '#04211f' },
  { fundo: '#e2648f', sombra: '#8a2d51', texto: '#f6f1e4' },
]

/** Hash estável entre execuções — o `hashCode` clássico, sem dependência. */
function embaralhar(texto: string): number {
  let acumulado = 0
  for (let i = 0; i < texto.length; i += 1) {
    acumulado = (acumulado * 31 + texto.charCodeAt(i)) | 0
  }
  return Math.abs(acumulado)
}

export function corDoKart(participanteId: string): CorDeKart {
  return CORES_DE_KART[embaralhar(participanteId) % CORES_DE_KART.length]
}

/**
 * Primeira letra visível do nome, em caixa alta. Nomes que começam por espaço,
 * emoji ou pontuação caem no traço em vez de renderizar um selo vazio.
 */
export function inicialDoNome(nome: string): string {
  const primeira = Array.from(nome.trim()).find((c) => /\p{L}|\p{N}/u.test(c))
  return primeira ? primeira.toLocaleUpperCase('pt-BR') : '–'
}

/** Número do kart exibido na sala: a ordem em que a pessoa entrou. */
export function numeroDoKart(ordemDeEntrada: number): string {
  return String(ordemDeEntrada).padStart(2, '0')
}
