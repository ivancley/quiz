import type { ReactNode } from 'react'

import estilos from './Moldura.module.css'

type Props = {
  children: ReactNode
  /** Fundo próprio da tela, quando ela usa gradiente em vez da cor lisa. */
  fundo?: string
}

/**
 * A tela do participante. Em celular ocupa a viewport inteira; em telas largas
 * vira a caixa de 390×780 do desenho, para conferência lado a lado.
 */
export function Moldura({ children, fundo }: Props) {
  return (
    <div className={estilos.centralizador}>
      <div className={estilos.moldura} style={fundo ? { background: fundo } : undefined}>
        {children}
      </div>
    </div>
  )
}
