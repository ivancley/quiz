import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  CORES_DE_KART,
  corDoKart,
  inicialDoNome,
  numeroDoKart,
} from '@/lib/kart'

describe('cor do kart', () => {
  it('devolve sempre a mesma cor para o mesmo participante', () => {
    const id = '3f2a9c1e-4b5d-4e6f-8a9b-0c1d2e3f4a5b'
    expect(corDoKart(id)).toEqual(corDoKart(id))
  })

  it('devolve uma cor da paleta do tema', () => {
    expect(CORES_DE_KART).toContainEqual(corDoKart(randomUUID()))
  })

  it('distribui as cores por toda a paleta numa sala cheia', () => {
    const usadas = new Set(
      Array.from({ length: 300 }, () => corDoKart(randomUUID()).fundo)
    )
    expect(usadas.size).toBe(CORES_DE_KART.length)
  })

  it('não concentra a sala numa cor só', () => {
    const contagem = new Map<string, number>()
    for (let i = 0; i < 800; i += 1) {
      const cor = corDoKart(randomUUID()).fundo
      contagem.set(cor, (contagem.get(cor) ?? 0) + 1)
    }
    const esperado = 800 / CORES_DE_KART.length
    for (const quantidade of contagem.values()) {
      expect(quantidade).toBeGreaterThan(esperado * 0.5)
      expect(quantidade).toBeLessThan(esperado * 1.5)
    }
  })
})

describe('inicial do nome', () => {
  it('usa a primeira letra em caixa alta', () => {
    expect(inicialDoNome('Marina Alves')).toBe('M')
    expect(inicialDoNome('rafael costa')).toBe('R')
  })

  it('ignora espaços à frente do nome', () => {
    expect(inicialDoNome('   Juliana')).toBe('J')
  })

  it('preserva letras acentuadas', () => {
    expect(inicialDoNome('Ângela')).toBe('Â')
  })

  it('pula emoji e pontuação até achar uma letra', () => {
    expect(inicialDoNome('🏎️ Bruno')).toBe('B')
    expect(inicialDoNome('...Carla')).toBe('C')
  })

  it('aceita nome que começa por número', () => {
    expect(inicialDoNome('7 de Setembro')).toBe('7')
  })

  it('cai no traço quando não há letra nem número', () => {
    expect(inicialDoNome('🏁')).toBe('–')
    expect(inicialDoNome('   ')).toBe('–')
  })
})

describe('número do kart', () => {
  it('usa dois dígitos para caber no selo', () => {
    expect(numeroDoKart(7)).toBe('07')
    expect(numeroDoKart(23)).toBe('23')
  })

  it('não trunca uma sala com mais de cem pessoas', () => {
    expect(numeroDoKart(104)).toBe('104')
  })
})
