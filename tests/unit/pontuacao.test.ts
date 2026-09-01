import { describe, expect, it } from 'vitest'

import {
  bonusPorOrdem,
  pontosPorOrdem,
  totalPorOrdens,
} from '@/server/pontuacao'

describe('pontos de um acerto', () => {
  it('dá quatro ao primeiro, três ao segundo, dois ao terceiro e um aos demais', () => {
    expect([1, 2, 3, 4, 5, 20].map(pontosPorOrdem)).toEqual([4, 3, 2, 1, 1, 1])
  })

  it('separa o ponto do acerto do bônus de velocidade', () => {
    expect([1, 2, 3, 4].map(bonusPorOrdem)).toEqual([3, 2, 1, 0])
  })

  it('nunca dá menos que o ponto do acerto, por mais tarde que venha', () => {
    for (const ordem of [4, 10, 50, 1000]) {
      expect(pontosPorOrdem(ordem)).toBe(1)
    }
  })
})

describe('total ao longo da sessão', () => {
  it('soma os acertos de quem chegou em lugares diferentes', () => {
    // Primeiro numa pergunta, terceiro em outra, e mais dois acertos comuns.
    expect(totalPorOrdens([1, 3, 5, 8])).toBe(4 + 2 + 1 + 1)
  })

  it('é zero para quem não acertou nada', () => {
    expect(totalPorOrdens([])).toBe(0)
  })

  it('reproduz o caso de referência: cinco pessoas, uma pergunta', () => {
    // Todas acertam a mesma pergunta, na ordem em que responderam.
    const totais = [1, 2, 3, 4, 5].map((ordem) => totalPorOrdens([ordem]))

    expect(totais).toEqual([4, 3, 2, 1, 1])
  })
})
