/**
 * A regra de pontos da corrida, isolada de qualquer banco ou tela.
 *
 * Quem acerta ganha um ponto. Além disso, os três primeiros a acertar *aquela*
 * pergunta ganham um bônus de velocidade: 3, 2 e 1. Ninguém ganha bônus por
 * errar rápido, e errar não consome lugar na fila — a ordem é contada só entre
 * os acertos.
 *
 * Nada disso é armazenado. A ordem de acerto não é uma decisão tomada na hora
 * de gravar a resposta: é uma consequência dos dados que já estão lá, e por isso
 * não existe trava, corrida nem estado duplicado que possa divergir do placar.
 */

/** Bônus do primeiro, do segundo e do terceiro a acertar. */
export const BONUS_POR_ORDEM = [3, 2, 1] as const

/** Todo acerto vale isto, tenha vindo em que lugar for. */
export const PONTO_POR_ACERTO = 1

/**
 * `ordem` é a colocação do acerto dentro da pergunta, contada a partir de 1.
 * Quem não acertou não tem ordem e não passa por aqui.
 */
export function bonusPorOrdem(ordem: number): number {
  return BONUS_POR_ORDEM[ordem - 1] ?? 0
}

export function pontosPorOrdem(ordem: number): number {
  return PONTO_POR_ACERTO + bonusPorOrdem(ordem)
}

/** O total de quem acertou nas colocações dadas, ao longo da sessão inteira. */
export function totalPorOrdens(ordens: readonly number[]): number {
  return ordens.reduce((soma, ordem) => soma + pontosPorOrdem(ordem), 0)
}
