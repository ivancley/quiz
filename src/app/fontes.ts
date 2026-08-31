import localFont from 'next/font/local'

/*
 * As duas fontes ficam no repositório em vez de virem do Google Fonts no build.
 * Assim a imagem Docker compila sem rede, o resultado é o mesmo em qualquer
 * máquina, e a sala não depende de um servidor de terceiros para desenhar a
 * interface. Os arquivos são o subconjunto latino, que cobre o português.
 */

export const fontePixel = localFont({
  src: [
    { path: './fontes/silkscreen-400.woff2', weight: '400', style: 'normal' },
    { path: './fontes/silkscreen-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--fonte-pixel',
  fallback: ['ui-monospace', 'monospace'],
  adjustFontFallback: false,
})

export const fonteCorpo = localFont({
  // Arquivo variável: um só desenho cobre de 300 a 700.
  src: [
    {
      path: './fontes/space-grotesk-variavel.woff2',
      weight: '300 700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--fonte-corpo',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
  adjustFontFallback: false,
})
