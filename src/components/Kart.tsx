import { corDoKart, inicialDoNome } from '@/lib/kart'

import estilos from './Kart.module.css'

type Tamanho = 'pequeno' | 'medio' | 'grande' | 'enorme'

type Props = {
  participanteId: string
  nome: string
  tamanho?: Tamanho
  /** Contorno em destaque, usado para marcar o campeão no pódio. */
  destacado?: boolean
}

export function Kart({
  participanteId,
  nome,
  tamanho = 'medio',
  destacado = false,
}: Props) {
  const cor = corDoKart(participanteId)

  return (
    <span
      className={`${estilos.kart} ${estilos[tamanho]} pixel`}
      style={{
        background: cor.fundo,
        color: cor.texto,
        borderColor: destacado ? 'var(--amarelo)' : 'var(--texto)',
        boxShadow: `0 var(--relevo) 0 ${cor.sombra}`,
      }}
      // O selo é decoração de um nome que já está escrito ao lado; anunciar a
      // inicial de novo só atrapalharia quem usa leitor de tela.
      aria-hidden="true"
    >
      {inicialDoNome(nome)}
    </span>
  )
}
