import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { fonteCorpo, fontePixel } from './fontes'
import './globals.css'

export const metadata: Metadata = {
  title: 'Grand Prix do Conhecimento',
  description: 'Quiz ao vivo por QR Code',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0e1c',
}

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${fontePixel.variable} ${fonteCorpo.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
