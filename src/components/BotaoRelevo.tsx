import type { ButtonHTMLAttributes } from 'react'

import estilos from './BotaoRelevo.module.css'

type Tom = 'verde' | 'vermelho' | 'azul' | 'amarelo' | 'neutro'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tom?: Tom
  /** Ocupa toda a largura disponível — o padrão nas telas de celular. */
  largo?: boolean
}

export function BotaoRelevo({
  tom = 'verde',
  largo = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={[
        estilos.botao,
        estilos[tom],
        largo ? estilos.largo : '',
        'pixel',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...resto}
    />
  )
}
