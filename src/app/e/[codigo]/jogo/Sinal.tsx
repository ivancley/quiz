import type { Conexao } from './Jogo'
import estilos from './jogo.module.css'

/**
 * O estado do canal de avisos, dito em voz alta.
 *
 * Numa sala com rede oscilante, a diferença entre "a etapa ainda não abriu" e
 * "meu celular perdeu a conexão" é a diferença entre esperar e levantar a mão.
 */
export function Sinal({ conexao }: { conexao: Conexao }) {
  const conectado = conexao === 'conectado'

  return (
    <p
      className={`${estilos.sinal} ${conectado ? estilos.online : estilos.offline}`}
      role="status"
    >
      <span className={estilos.ponto} aria-hidden="true" />
      <span className={`pixel ${estilos.rotulo}`}>
        {conectado ? 'CONECTADO' : 'RECONECTANDO'}
      </span>
    </p>
  )
}
