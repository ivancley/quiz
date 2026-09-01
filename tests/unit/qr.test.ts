import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'

import { enderecoDeEntrada, qrEmPng, qrEmSvg } from '@/server/qr'

const BASE = process.env.APP_BASE_URL as string

/** Margem clara em volta do código, em módulos, usada na geração. */
const MARGEM = 2

/**
 * Coordenadas dos módulos escuros desenhados no SVG.
 *
 * O caminho vem como corridas horizontais — `M x y.5` posiciona, `h n` pinta n
 * módulos e `m dx 0` pula os claros. Reconstituir a matriz a partir daí é o que
 * permite afirmar que a imagem projetada é o código daquele endereço, e não de
 * outro qualquer, sem depender de um leitor de QR nos testes.
 */
function modulosEscurosDoSvg(svg: string): Set<string> {
  const caminho = /<path stroke="[^"]*" d="([^"]*)"/.exec(svg)?.[1] ?? ''
  const escuros = new Set<string>()
  let x = 0
  let y = 0

  for (const [, comando, primeiro, segundo] of caminho.matchAll(
    /([Mmh])(-?[\d.]+)(?: (-?[\d.]+))?/g
  )) {
    if (comando === 'M') {
      x = Number(primeiro)
      y = Math.floor(Number(segundo))
    } else if (comando === 'm') {
      x += Number(primeiro)
    } else {
      const largura = Number(primeiro)
      for (let i = 0; i < largura; i += 1) escuros.add(`${x + i},${y}`)
      x += largura
    }
  }

  return escuros
}

/** A mesma matriz, vinda direto do codificador, para servir de referência. */
function modulosEscurosDoTexto(texto: string): Set<string> {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'H' })
  const escuros = new Set<string>()

  for (let linha = 0; linha < modules.size; linha += 1) {
    for (let coluna = 0; coluna < modules.size; coluna += 1) {
      if (modules.data[linha * modules.size + coluna]) {
        escuros.add(`${coluna + MARGEM},${linha + MARGEM}`)
      }
    }
  }

  return escuros
}

describe('endereço de entrada', () => {
  it('aponta para a página do quiz sob o endereço público', () => {
    expect(enderecoDeEntrada('ABC123')).toBe(`${BASE}/e/ABC123`)
  })

  it('não produz barra dobrada quando o endereço base termina em barra', () => {
    const original = process.env.APP_BASE_URL
    process.env.APP_BASE_URL = 'https://quiz.exemplo.br/'

    try {
      expect(enderecoDeEntrada('ABC123')).toBe(
        'https://quiz.exemplo.br/e/ABC123'
      )
    } finally {
      process.env.APP_BASE_URL = original
    }
  })

  it('recusa um endereço público sem protocolo', () => {
    const original = process.env.APP_BASE_URL
    process.env.APP_BASE_URL = 'quiz.exemplo.br'

    try {
      expect(() => enderecoDeEntrada('ABC123')).toThrow(/APP_BASE_URL/)
    } finally {
      process.env.APP_BASE_URL = original
    }
  })
})

describe('QR Code do quiz', () => {
  it('desenha o código do endereço de entrada daquele quiz', async () => {
    const svg = await qrEmSvg('7XK29Q')

    expect(modulosEscurosDoSvg(svg)).toEqual(
      modulosEscurosDoTexto(`${BASE}/e/7XK29Q`)
    )
  })

  it('não desenha o código de um endereço parecido', async () => {
    const svg = await qrEmSvg('7XK29Q')

    expect(modulosEscurosDoSvg(svg)).not.toEqual(
      modulosEscurosDoTexto(`${BASE}/e/7XK29R`)
    )
  })

  it('sai como SVG, que escala sem serrilhar na projeção', async () => {
    const svg = await qrEmSvg('7XK29Q')

    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox')
  })

  it('sai como PNG para baixar', async () => {
    const png = await qrEmPng('7XK29Q')

    // Assinatura do formato: os oito primeiros bytes de todo arquivo PNG.
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  })
})
