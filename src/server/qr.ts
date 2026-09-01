import QRCode from 'qrcode'

import { enderecoPublicoBase } from '@/server/ambiente'

/**
 * O QR projetado na parede é a única porta de entrada da sala: quem chega
 * aponta a câmera e cai direto na página do quiz. Por isso o endereço embutido
 * nele é absoluto, montado a partir do endereço público configurado — um
 * caminho relativo funcionaria no navegador do organizador e em lugar nenhum
 * mais.
 */

export function enderecoDeEntrada(codigo: string): string {
  return `${enderecoPublicoBase()}/e/${codigo}`
}

/**
 * Correção de erro alta: o código vai ser fotografado de longe, torto e com o
 * reflexo do projetor por cima. Sobra de redundância aqui custa alguns módulos
 * a mais e evita a leitura que não pega.
 */
const CORRECAO = 'H' as const

export function qrEmSvg(codigo: string): Promise<string> {
  return QRCode.toString(enderecoDeEntrada(codigo), {
    type: 'svg',
    errorCorrectionLevel: CORRECAO,
    margin: 2,
    // Sem cor no SVG: ele herda o fundo claro da moldura da tela de projeção.
    color: { dark: '#0b0e1c', light: '#ffffff' },
  })
}

/** Versão para baixar e colar em slide, cartaz ou convite. */
export function qrEmPng(codigo: string): Promise<Buffer> {
  return QRCode.toBuffer(enderecoDeEntrada(codigo), {
    type: 'png',
    errorCorrectionLevel: CORRECAO,
    margin: 2,
    // Grande o bastante para uma projeção ou uma impressão em A4 sem serrilhar.
    width: 1024,
    color: { dark: '#0b0e1c', light: '#ffffff' },
  })
}
